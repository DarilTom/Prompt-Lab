import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import Hero from '../components/landing/Hero'
import ProductShowcase from '../components/landing/ProductShowcase'
import Features from '../components/landing/Features'
import Workflow from '../components/landing/Workflow'
import Research from '../components/landing/Research'
import FinalCta from '../components/landing/FinalCta'

export default function Landing() {
  return (
    <div id="top" className="min-h-dvh bg-background text-ink">
      <Navbar />
      <main>
        <Hero />
        <ProductShowcase />
        <Features />
        <Workflow />
        <Research />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
