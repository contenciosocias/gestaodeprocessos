/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta CIAS — vermelho/laranja/branco. Cor forte só como ACENTO.
        // Ajuste estes valores aos tons exatos extraídos do arquivo do logo.
        cias: {
          vermelho: '#D81E05', // acento primário
          laranja: '#F47A1F', // acento secundário
          base: '#FFFFFF', // fundo base
          superficie: '#FAFAF8', // superfície clara
          superficie2: '#F2F2EF', // superfície alternativa / hover
          borda: '#E6E6E1', // divisórias finas
          texto: '#1C1C1C', // texto principal
          texto2: '#6B6B6B', // texto secundário
          sucesso: '#2E7D32', // sucesso discreto (status Providenciada)
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
