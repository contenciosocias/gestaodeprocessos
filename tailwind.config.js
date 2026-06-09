/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta CIAS — vermelho/laranja/branco. Cor forte só como ACENTO.
        // Ajuste estes valores aos tons exatos extraídos do arquivo do logo.
        cias: {
          // Cores extraídas da arte do logo (vermelho #ED000A, laranja #F87200),
          // levemente ajustadas para uso em UI. Cor forte só como ACENTO.
          vermelho: '#E2120A', // acento primário (marca)
          vermelhoEscuro: '#BE0E08', // hover/pressed
          laranja: '#F87200', // acento secundário (marca)
          laranjaEscuro: '#DC6500',
          base: '#FFFFFF', // branco (cards, sidebar)
          superficie: '#F6F5F2', // fundo do conteúdo (off-white)
          superficie2: '#EEEDE8', // hover / faixas
          borda: '#E6E4DE', // divisórias finas
          texto: '#1A1A1A', // texto principal
          texto2: '#6B6B6B', // texto secundário
          texto3: '#9C9C96', // texto auxiliar (muted)
          sucesso: '#2E7D32', // sucesso discreto (status Providenciada / polo ativo)
          sucessoBg: '#EAF3EA',
          roxo: '#6D28D9', // polo "interessado"
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
