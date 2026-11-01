// Tokens de color de Tailwind (CDN). Lo cargan index.html y app.html justo después de Tailwind,
// así las dos páginas comparten la misma paleta sin duplicarla.
tailwind.config = {
  theme: {
    extend: {
      colors: {
        cream: '#fbf6ea',
        paper: '#fffdf7',
        ink: '#23312b',
        moss: '#2f6f4e',
        leaf: '#4f9d69',
        line: '#eadfc6',
      },
    },
  },
};
