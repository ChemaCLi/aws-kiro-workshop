// Exporta presentation.html a un .pptx con objetos nativos por diapositiva:
//   - capa de fondo (tarjetas, degradados, bordes) como una imagen sin texto,
//   - textos editables con la misma fuente, color, tamaño y saltos de línea,
//   - imágenes, GIF animados reales (el WebP animado se convierte a GIF) y videos incrustados,
//   - notas del orador.
// Uso: node export.mjs [salida.pptx]   (por defecto: ../../todos-pueden-programar-con-kiro.pptx)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';
import JSZip from 'jszip';

const SLIDE_WIDTH_PX = 1920;
const SLIDE_HEIGHT_PX = 1080;
const SLIDE_WIDTH_IN = 13.333;
const SLIDE_HEIGHT_IN = 7.5;
const PX_TO_PT = 0.5; // 1920 px = 960 pt, así que 1 px = 0.5 pt
const TRANSITION_SETTLE_MS = 900;
const BACKGROUND_IMAGE_MIN_AREA_RATIO = 0.6; // una imagen que cubre casi toda la diapositiva se queda en el fondo
// Un WebP de 291 cuadros pesa ~17 MB como GIF sin ajustes; con estos límites de error baja a ~6 MB sin diferencia visible.
const GIF_OUTPUT_OPTIONS = { interFrameMaxError: 16, interPaletteMaxError: 10, colours: 128, effort: 7 };
const CAPTURE_MAX_ATTEMPTS = 4;
const BLANK_STDEV_THRESHOLD = 0.5;
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const presentationDir = path.resolve(toolDir, '../..');
const htmlPath = path.join(presentationDir, 'presentation.html');
const outputPath = path.resolve(process.argv[2] || path.join(presentationDir, 'todos-pueden-programar-con-kiro.pptx'));

/**
 * Estilo auxiliar para la capa de fondo: oculta texto y medios (se colocan después como objetos nativos).
 * Las imágenes y SVG individuales ya NO se aíslan con visibility para capturarlos: en Chrome headless, alternar
 * `visibility` en todo el documento y luego hacer `page.screenshot()` dentro del mismo navegador deja, a partir
 * de la segunda diapositiva visitada por hash, esa captura permanentemente en blanco (bug de compositing, no
 * del contenido). En su lugar se recorta la página ya renderizada tal cual (ver captureElementPng).
 */
const EXPORT_CSS = `
  .deck-pager{display:none !important}
  html.exp-bg [data-exp-media]{visibility:hidden !important}
  html.exp-bg [data-exp-text], html.exp-bg [data-exp-text] *{
    color:transparent !important; -webkit-text-fill-color:transparent !important; text-shadow:none !important; text-decoration-color:transparent !important}
`;

/** Deja la diapositiva en su estado final: sin pasos ocultos y con los videos mostrando un cuadro sin controles. */
async function settleSlide(page, index) {
  await page.evaluate(async (slideIndex) => {
    const slide = document.querySelectorAll('.deck-slide')[slideIndex];
    slide.querySelectorAll('[data-build-hidden]').forEach((node) => node.removeAttribute('data-build-hidden'));
    for (const video of slide.querySelectorAll('video')) {
      video.pause();
      video.removeAttribute('controls'); // los controles del navegador no deben quedar en la captura
      if (video.readyState < 2) await new Promise((resolve) => { video.addEventListener('loadeddata', resolve, { once: true }); setTimeout(resolve, 3000); });
      video.currentTime = 0.1;
      await new Promise((resolve) => { video.addEventListener('seeked', resolve, { once: true }); setTimeout(resolve, 1500); });
    }
    await document.fonts.ready;
    await Promise.all([...slide.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
  }, index);
}

/**
 * Recorre la diapositiva en el navegador y devuelve, en orden de pintado, los objetos a crear:
 * text, image, capture (SVG), video. Marca en el DOM lo que se extrae para poder ocultarlo en la capa de fondo.
 */
function extractSlideItems(slideIndex, limits) {
  const slide = document.querySelectorAll('.deck-slide')[slideIndex];
  const items = [];

  const parseColor = (value) => {
    const numbers = (value.match(/[\d.]+/g) || []).map(Number);
    if (numbers.length < 3) return { hex: '000000', alpha: 1 };
    const hex = numbers.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    return { hex, alpha: numbers.length > 3 ? numbers[3] : 1 };
  };

  const effectiveOpacity = (element) => {
    let opacity = 1;
    for (let node = element; node && node !== slide; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
    return opacity;
  };

  const pxValue = (value) => (value && value !== 'normal' ? parseFloat(value) || 0 : 0);

  const hasOwnText = (element) => [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim() !== '');

  const rectOf = (element) => {
    const box = element.getBoundingClientRect();
    return { x: box.left, y: box.top, w: box.width, h: box.height };
  };

  /** Estilo de un tramo de texto (color, fuente, peso...) tomado del elemento que lo contiene. */
  const runStyleOf = (element, opacity) => {
    const style = getComputedStyle(element);
    const color = parseColor(style.color);
    return {
      fontFamily: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      fontSizePx: parseFloat(style.fontSize),
      bold: parseInt(style.fontWeight, 10) >= 600,
      italic: style.fontStyle === 'italic',
      underline: style.textDecorationLine.includes('underline'),
      color: color.hex,
      alpha: color.alpha * opacity,
      letterSpacingPx: pxValue(style.letterSpacing),
      textTransform: style.textTransform,
    };
  };

  const styleKey = (style) => JSON.stringify(style);

  /** Un bloque de texto: se parte en líneas tal como las dibuja el navegador para conservar los saltos. */
  const addTextBlock = (element, blockStyle) => {
    const opacity = effectiveOpacity(element);
    const styleCache = new Map();
    const lineHeightFallbackPx = parseFloat(blockStyle.fontSize) * 1.2;
    const lineHeightPx = pxValue(blockStyle.lineHeight) || lineHeightFallbackPx;
    const range = document.createRange();
    const lines = [];
    let currentLine = null;
    let pendingBreaks = 0;

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 1) {
        if (node.tagName === 'BR') pendingBreaks += 1;
        continue;
      }
      const owner = node.parentElement;
      const ownerStyle = getComputedStyle(owner);
      if (ownerStyle.display === 'none' || ownerStyle.visibility === 'hidden') continue;
      if (!styleCache.has(owner)) styleCache.set(owner, runStyleOf(owner, opacity));
      const runStyle = styleCache.get(owner);
      const keepsNewlines = ['pre', 'pre-wrap', 'pre-line', 'break-spaces'].includes(ownerStyle.whiteSpace);

      let offset = 0;
      for (const character of node.textContent) {
        const characterStart = offset;
        offset += character.length;
        if (character === '\n' && keepsNewlines) { pendingBreaks += 1; continue; }
        range.setStart(node, characterStart);
        range.setEnd(node, offset);
        const boxes = range.getClientRects();
        if (boxes.length === 0) continue; // espacio colapsado: el navegador no lo dibuja
        const box = boxes[0];

        const startsNewLine = currentLine === null || pendingBreaks > 0 || box.top > currentLine.top + lineHeightPx * 0.6;
        if (startsNewLine) {
          if (character === ' ' && currentLine === null) continue; // sin espacios al inicio del bloque
          for (let blank = 1; blank < pendingBreaks; blank++) lines.push({ runs: [], top: null, left: 0, right: 0, empty: true });
          currentLine = { runs: [], top: box.top, height: box.height, left: box.left, right: box.right };
          lines.push(currentLine);
          pendingBreaks = 0;
          if (character === ' ') continue; // sin espacios al inicio de cada línea
        }
        currentLine.left = Math.min(currentLine.left, box.left);
        currentLine.right = Math.max(currentLine.right, box.right);

        const visibleCharacter = runStyle.textTransform === 'uppercase' ? character.toUpperCase() : character;
        const lastRun = currentLine.runs[currentLine.runs.length - 1];
        if (lastRun && styleKey(lastRun.style) === styleKey(runStyle)) lastRun.text += visibleCharacter;
        else currentLine.runs.push({ text: visibleCharacter, style: runStyle });
      }
    }

    lines.forEach((line) => {
      const lastRun = line.runs[line.runs.length - 1];
      if (lastRun) lastRun.text = lastRun.text.replace(/\s+$/, ''); // sin espacios al final de cada línea
    });
    const drawnLines = lines.filter((line) => line.empty || line.runs.some((run) => run.text !== ''));
    if (drawnLines.length === 0) return;

    const measured = drawnLines.filter((line) => !line.empty);
    const firstLine = measured[0];
    const minLeft = Math.min(...measured.map((line) => line.left));
    const maxRight = Math.max(...measured.map((line) => line.right));
    const firstLineBoxTop = firstLine.top - (lineHeightPx - firstLine.height) / 2; // el navegador centra el texto en la altura de línea

    const content = element.getBoundingClientRect();
    const paddingLeft = pxValue(blockStyle.paddingLeft) + pxValue(blockStyle.borderLeftWidth);
    const paddingRight = pxValue(blockStyle.paddingRight) + pxValue(blockStyle.borderRightWidth);
    const contentCenterX = (content.left + paddingLeft + content.right - paddingRight) / 2;

    const alignment = ['right', 'end'].includes(blockStyle.textAlign) ? 'right' : blockStyle.textAlign === 'center' ? 'center' : 'left';
    element.setAttribute('data-exp-text', '');
    items.push({
      kind: 'text',
      alignment,
      lineHeightPx,
      lines: drawnLines.map((line) => ({ empty: Boolean(line.empty), runs: line.runs.filter((run) => run.text !== '') })),
      minLeft,
      maxRight,
      centerX: contentCenterX,
      top: firstLineBoxTop,
      fallbackFontSizePx: parseFloat(blockStyle.fontSize),
      fallbackFontFamily: blockStyle.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    });
  };

  const addVideo = (element) => {
    element.setAttribute('data-exp-media', '');
    items.push({ kind: 'video', src: element.getAttribute('src') || element.querySelector('source')?.getAttribute('src'), ...rectOf(element) });
  };

  /** Imágenes: la capa de fondo conserva las que cubren casi todo; el resto se extrae (animadas o capturadas). */
  const addImage = (element, style) => {
    const box = rectOf(element);
    if (box.w * box.h >= limits.width * limits.height * limits.backgroundAreaRatio) return;
    element.setAttribute('data-exp-media', '');
    const padding = style.filter !== 'none' ? 10 : 0; // deja espacio al brillo (drop-shadow) del logo
    items.push({
      kind: 'image',
      src: element.getAttribute('src'),
      fit: style.objectFit,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      padding,
      ...box,
    });
  };

  const addSvg = (element, style) => {
    element.setAttribute('data-exp-media', '');
    const padding = style.filter !== 'none' ? 10 : 0;
    items.push({ kind: 'capture', padding, ...rectOf(element) });
  };

  const walk = (element) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return;
    const tag = element.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;
    if (tag === 'video') return addVideo(element);
    if (tag === 'img') return addImage(element, style);
    if (tag === 'svg') return addSvg(element, style);
    if (hasOwnText(element)) return addTextBlock(element, style);
    for (const child of element.children) walk(child);
  };

  walk(slide.querySelector('.deck-scaler') || slide);
  return { label: slide.dataset.label || '', notes: slide.dataset.speakerNotes || '', items };
}

const pxToInchesX = (px) => (px / SLIDE_WIDTH_PX) * SLIDE_WIDTH_IN;
const pxToInchesY = (px) => (px / SLIDE_HEIGHT_PX) * SLIDE_HEIGHT_IN;

/** Convierte un bloque de texto extraído en un cuadro de texto nativo. */
function addTextItem(slide, item) {
  const textRuns = [];
  item.lines.forEach((line, lineIndex) => {
    const isLast = lineIndex === item.lines.length - 1;
    const paragraphOptions = { align: item.alignment, lineSpacing: Math.round(item.lineHeightPx * PX_TO_PT * 100) / 100 };
    if (line.empty || line.runs.length === 0) {
      textRuns.push({ text: ' ', options: { ...paragraphOptions, fontSize: item.fallbackFontSizePx * PX_TO_PT, fontFace: item.fallbackFontFamily, breakLine: !isLast } });
      return;
    }
    line.runs.forEach((run, runIndex) => {
      const options = {
        fontFace: run.style.fontFamily.startsWith('ui-') ? 'Arial' : run.style.fontFamily,
        fontSize: run.style.fontSizePx * PX_TO_PT,
        bold: run.style.bold,
        italic: run.style.italic,
        color: run.style.color,
      };
      if (run.style.underline) options.underline = { style: 'sng' };
      if (run.style.alpha < 1) options.transparency = Math.round((1 - run.style.alpha) * 100);
      if (run.style.letterSpacingPx) options.charSpacing = run.style.letterSpacingPx * PX_TO_PT;
      if (runIndex === 0) Object.assign(options, paragraphOptions);
      if (runIndex === line.runs.length - 1 && !isLast) options.breakLine = true;
      textRuns.push({ text: run.text, options });
    });
  });

  const textWidth = item.maxRight - item.minLeft;
  const boxWidth = textWidth + 12; // margen de holgura: el texto no se parte (wrap desactivado) y no se recorta
  const boxHeight = item.lines.length * item.lineHeightPx;
  let boxLeft = item.minLeft;
  if (item.alignment === 'right') boxLeft = item.maxRight - boxWidth;
  if (item.alignment === 'center') boxLeft = item.centerX - boxWidth / 2;

  slide.addText(textRuns, {
    x: pxToInchesX(boxLeft),
    y: pxToInchesY(item.top),
    w: pxToInchesX(boxWidth),
    h: pxToInchesY(boxHeight),
    margin: 0,
    valign: 'top',
    wrap: false,
    fit: 'none',
  });
}

/** Si la imagen es animada (GIF o WebP animado), devuelve el GIF listo para colocar en su caja; si no, null. */
async function prepareAnimatedImage(item, gifCache) {
  const sourcePath = path.resolve(presentationDir, item.src);
  if (!/\.(gif|webp)$/i.test(sourcePath) || !fs.existsSync(sourcePath)) return null;
  const meta = await sharp(sourcePath, { animated: true }).metadata();
  if (!meta.pages || meta.pages <= 1) return null;

  const naturalWidth = meta.width;
  const naturalHeight = meta.pageHeight || meta.height;
  const box = { x: item.x, y: item.y, w: item.w, h: item.h };

  if (item.fit === 'cover') {
    // Recorta en el tamaño natural la parte que se ve, sin ampliar la imagen.
    const scale = Math.max(box.w / naturalWidth, box.h / naturalHeight);
    const cropWidth = Math.min(naturalWidth, Math.round(box.w / scale));
    const cropHeight = Math.min(naturalHeight, Math.round(box.h / scale));
    const cacheKey = `${sourcePath}|cover|${cropWidth}x${cropHeight}`;
    if (!gifCache.has(cacheKey)) {
      const buffer = await sharp(sourcePath, { animated: true }).resize(cropWidth, cropHeight, { fit: 'cover', position: 'centre' }).gif(GIF_OUTPUT_OPTIONS).toBuffer();
      gifCache.set(cacheKey, buffer);
    }
    return { box, data: gifCache.get(cacheKey) };
  }

  let placedBox = box;
  if (item.fit === 'contain' || item.fit === 'scale-down') {
    const scale = Math.min(box.w / naturalWidth, box.h / naturalHeight);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    placedBox = { x: box.x + (box.w - width) / 2, y: box.y + (box.h - height) / 2, w: width, h: height };
  }
  if (/\.gif$/i.test(sourcePath)) return { box: placedBox, path: sourcePath };

  const cacheKey = `${sourcePath}|gif`;
  if (!gifCache.has(cacheKey)) gifCache.set(cacheKey, await sharp(sourcePath, { animated: true }).gif(GIF_OUTPUT_OPTIONS).toBuffer());
  return { box: placedBox, data: gifCache.get(cacheKey) };
}

/**
 * Recorta la diapositiva ya renderizada (sin aislar el elemento con `visibility`): esa zona es idéntica a la
 * que luego tapa la capa de fondo, así que el recorte "sucio" se ve igual que uno aislado una vez superpuesto.
 */
async function captureElementPng(page, item) {
  const clip = {
    x: Math.max(0, item.x - item.padding),
    y: Math.max(0, item.y - item.padding),
  };
  clip.width = Math.min(SLIDE_WIDTH_PX, item.x + item.w + item.padding) - clip.x;
  clip.height = Math.min(SLIDE_HEIGHT_PX, item.y + item.h + item.padding) - clip.y;

  let png = null;
  for (let attempt = 1; attempt <= CAPTURE_MAX_ATTEMPTS; attempt++) {
    png = await page.screenshot({ type: 'png', encoding: 'base64', clip });
    if (!(await isBlankImage(Buffer.from(png, 'base64')))) break;
    console.warn(`  Captura vacía de ${item.src || 'SVG'} (intento ${attempt}/${CAPTURE_MAX_ATTEMPTS}), reintentando...`);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (await isBlankImage(Buffer.from(png, 'base64'))) console.warn(`  ATENCIÓN: ${item.src || 'SVG'} salió vacía.`);

  return { png, clip };
}

/** Una captura sin variación en ningún canal (todo blanco o todo transparente) es señal de que la imagen no se pintó. */
async function isBlankImage(pngBuffer) {
  const { channels } = await sharp(pngBuffer).ensureAlpha().stats();
  return channels.every((channel) => channel.stdev < BLANK_STDEV_THRESHOLD);
}

const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: SLIDE_WIDTH_PX, height: SLIDE_HEIGHT_PX, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 });
await page.addStyleTag({ content: EXPORT_CSS });

const slideCount = await page.evaluate(() => document.querySelectorAll('.deck-slide').length);
const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'DECK_16_9', width: SLIDE_WIDTH_IN, height: SLIDE_HEIGHT_IN });
pptx.layout = 'DECK_16_9';
pptx.title = await page.title();

const gifCache = new Map();
const limits = { width: SLIDE_WIDTH_PX, height: SLIDE_HEIGHT_PX, backgroundAreaRatio: BACKGROUND_IMAGE_MIN_AREA_RATIO };

for (let index = 0; index < slideCount; index++) {
  await page.evaluate((hash) => { window.location.hash = hash; }, `#${index + 1}`);
  await new Promise((resolve) => setTimeout(resolve, TRANSITION_SETTLE_MS));
  await settleSlide(page, index);

  const info = await page.evaluate(extractSlideItems, index, limits);

  // 1) Portadas de video (el cuadro real, con la diapositiva a la vista).
  for (const item of info.items.filter((entry) => entry.kind === 'video')) {
    item.cover = await page.screenshot({ type: 'png', encoding: 'base64', clip: { x: item.x, y: item.y, width: item.w, height: item.h } });
  }

  // 2) Imágenes y SVG: animadas se colocan tal cual; las demás se recortan de la diapositiva ya renderizada.
  for (const item of info.items.filter((entry) => entry.kind === 'image' || entry.kind === 'capture')) {
    item.animated = item.kind === 'image' ? await prepareAnimatedImage(item, gifCache) : null;
    if (!item.animated) item.capture = await captureElementPng(page, item);
  }

  // 3) Capa de fondo: todo lo demás, sin texto ni medios.
  await page.evaluate(() => document.documentElement.classList.add('exp-bg'));
  const backgroundJpeg = await page.screenshot({ type: 'jpeg', quality: 95, encoding: 'base64' });
  await page.evaluate(() => document.documentElement.classList.remove('exp-bg'));

  const slide = pptx.addSlide();
  slide.addImage({ data: `image/jpeg;base64,${backgroundJpeg}`, x: 0, y: 0, w: SLIDE_WIDTH_IN, h: SLIDE_HEIGHT_IN, altText: `Fondo: ${info.label}` });

  const counts = { text: 0, image: 0, gif: 0, video: 0 };
  for (const item of info.items) {
    if (item.kind === 'text') {
      addTextItem(slide, item);
      counts.text += 1;
    } else if (item.kind === 'video') {
      const videoPath = path.resolve(presentationDir, item.src);
      if (!fs.existsSync(videoPath)) continue;
      slide.addMedia({
        type: 'video',
        path: videoPath,
        cover: `image/png;base64,${item.cover}`,
        x: pxToInchesX(item.x),
        y: pxToInchesY(item.y),
        w: pxToInchesX(item.w),
        h: pxToInchesY(item.h),
      });
      counts.video += 1;
    } else if (item.animated) {
      const { box, path: gifPath, data } = item.animated;
      const source = gifPath ? { path: gifPath } : { data: `image/gif;base64,${data.toString('base64')}` };
      slide.addImage({ ...source, x: pxToInchesX(box.x), y: pxToInchesY(box.y), w: pxToInchesX(box.w), h: pxToInchesY(box.h), altText: item.src });
      counts.gif += 1;
    } else {
      const { png, clip } = item.capture;
      slide.addImage({ data: `image/png;base64,${png}`, x: pxToInchesX(clip.x), y: pxToInchesY(clip.y), w: pxToInchesX(clip.width), h: pxToInchesY(clip.height), altText: item.src || 'Gráfico' });
      counts.image += 1;
    }
  }
  if (info.notes) slide.addNotes(info.notes);
  console.log(`Diapositiva ${index + 1}/${slideCount}: ${info.label} [textos ${counts.text}, imágenes ${counts.image}, gif ${counts.gif}, videos ${counts.video}]`);
}

await browser.close();

/**
 * pptxgenjs repite <a:pPr> en cada tramo de un mismo párrafo, y el esquema de PowerPoint solo admite uno
 * al inicio. Se deja el primero y se quitan los demás para que el archivo abra sin pedir reparación.
 */
function keepFirstParagraphProperties(slideXml) {
  const paragraphPropsPattern = /<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>(?:(?!<a:pPr\b)[\s\S])*?<\/a:pPr>/g;
  return slideXml.replace(/<a:p>[\s\S]*?<\/a:p>/g, (paragraph) => {
    let seenFirst = false;
    return paragraph.replace(paragraphPropsPattern, (match) => {
      if (!seenFirst) { seenFirst = true; return match; }
      return '';
    });
  });
}

const rawPptx = await pptx.write({ outputType: 'nodebuffer' });
const archive = await JSZip.loadAsync(rawPptx);
for (const name of Object.keys(archive.files).filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file))) {
  archive.file(name, keepFirstParagraphProperties(await archive.file(name).async('string')));
}
fs.writeFileSync(outputPath, await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Listo: ${outputPath}`);
process.exit(0);
