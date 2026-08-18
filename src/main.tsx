import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initBrand, BrandProvider } from '@/lib/brand'

// Se resuelve y aplica la marca antes del primer render para que no se vea un parpadeo
// con la paleta por defecto antes de la de la agencia.
const brand = initBrand()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrandProvider brand={brand}>
      <App />
    </BrandProvider>
  </StrictMode>,
)
