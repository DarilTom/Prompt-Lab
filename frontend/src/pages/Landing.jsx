import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import Hero from '../components/landing/Hero'
import ProductShowcase from '../components/landing/ProductShowcase'
import Features from '../components/landing/Features'
import Research from '../components/landing/Research'
import NextPhase from '../components/landing/NextPhase'
import Faq from '../components/landing/Faq'
import FinalCta from '../components/landing/FinalCta'

export default function Landing() {
  return (
    <div id='top' className='min-h-dvh bg-background text-ink'>
      <Navbar />
      <main>
        <Hero />
        <ProductShowcase />
        <Features />
        <Research />
        <NextPhase />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
