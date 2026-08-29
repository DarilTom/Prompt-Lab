import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'
import ShowcaseWorkspace from './ShowcaseWorkspace'

export default function ProductShowcase() {
  return (
    <section id="showcase" className="scroll-mt-20 pb-section">
      <Container>
        <SectionHeading
          eyebrow="Workspace"
          title="The product is the experiment bench."
          description="Prompts sit next to outputs, versions, and scores. No chat theatre — a lab surface you can actually work on."
        />
        <div className="mt-roomy">
          <ShowcaseWorkspace />
        </div>
      </Container>
    </section>
  )
}
