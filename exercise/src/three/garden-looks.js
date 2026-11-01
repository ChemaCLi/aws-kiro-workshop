// Luces del jardín por franja del día (mañana, mediodía, tarde y noche).
// Son datos puros: no importan Three.js, así se pueden leer sin cargar la escena.
// `midday` repite los valores originales de garden-scene.js para que el jardín se vea igual.
export const GARDEN_LOOKS = {
  morning:   { hemiSky: 0xfff1d6, hemiGround: 0x8fb89a, hemiIntensity: 1.5, sunColor: 0xffd9a8, sunIntensity: 2.0, sunPosition: [-9, 6, 5],  cloudColor: 0xfff4e6 },
  midday:    { hemiSky: 0xfff6e5, hemiGround: 0x7fa98a, hemiIntensity: 1.5, sunColor: 0xfff0d0, sunIntensity: 2.4, sunPosition: [7, 12, 5],  cloudColor: 0xffffff },
  afternoon: { hemiSky: 0xffe6c4, hemiGround: 0x8a9f7e, hemiIntensity: 1.3, sunColor: 0xffb877, sunIntensity: 2.2, sunPosition: [9, 5, -4],  cloudColor: 0xffe3cc },
  night:     { hemiSky: 0xa9b9e6, hemiGround: 0x56707a, hemiIntensity: 1.25, sunColor: 0xc4d0ff, sunIntensity: 1.3, sunPosition: [-6, 10, 6], cloudColor: 0xc4cde6 },
};
