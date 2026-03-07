import { Link } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'
import { Footer } from '../components/Footer'

export function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="fixed inset-0 bg-gradient-to-b from-amber-950/20 via-transparent to-zinc-950 pointer-events-none" aria-hidden />
      <main className="relative max-w-2xl mx-auto px-4 pt-6 pb-24">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-amber-400 text-sm mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Privacy & Data Protection</h1>
            <p className="text-zinc-400 text-sm mt-0.5">UK GDPR & Data Protection Act 2018</p>
          </div>
        </div>

        <div className="prose prose-invert prose-amber max-w-none space-y-6 text-zinc-300 text-sm leading-relaxed">
          <p>
            This application processes personal data in accordance with the UK General Data Protection Regulation (UK GDPR) 
            and the Data Protection Act 2018. We are committed to protecting your privacy and handling your data responsibly.
          </p>

          <section>
            <h2 className="text-lg font-semibold text-amber-400 mb-2">Data controller</h2>
            <p>
              The data controller responsible for your personal data is the business operating this vehicle inventory 
              and reservation system. If you have questions about how your data is handled, please contact the 
              business directly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-amber-400 mb-2">What data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Customers:</strong> Name, email address, phone number (when reserving a vehicle)</li>
              <li><strong>Staff users:</strong> Email, display name, role assignments (for access control)</li>
              <li><strong>Vehicle data:</strong> Stock ID, plate number, specifications, images (business records)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-amber-400 mb-2">Legal basis for processing</h2>
            <p>
              We process your data on the following legal bases under UK GDPR:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Contract:</strong> Processing necessary to fulfil a reservation or sale</li>
              <li><strong>Legitimate interests:</strong> Running our vehicle business, managing inventory and staff access</li>
              <li><strong>Consent:</strong> Where we explicitly ask for and you give consent (e.g. marketing, if applicable)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-amber-400 mb-2">How we use your data</h2>
            <p>
              Your data is used to manage vehicle reservations, communicate about your collection, 
              process handovers, and operate our internal systems. We do not sell your data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-amber-400 mb-2">Data retention</h2>
            <p>
              We retain personal data only for as long as necessary for the purposes described above, 
              or as required by law (e.g. tax and accounting records). Customer reservation data is 
              typically retained for the duration of the reservation and a reasonable period thereafter.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-amber-400 mb-2">Your rights</h2>
            <p>Under UK data protection law, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Access</strong> — request a copy of your personal data</li>
              <li><strong>Rectification</strong> — have inaccurate data corrected</li>
              <li><strong>Erasure</strong> — request deletion of your data in certain circumstances</li>
              <li><strong>Restrict processing</strong> — limit how we use your data</li>
              <li><strong>Object</strong> — object to processing based on legitimate interests</li>
              <li><strong>Data portability</strong> — receive your data in a structured, machine-readable format</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact the data controller. You also have the right to lodge a 
              complaint with the <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline">Information Commissioner&apos;s Office (ICO)</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-amber-400 mb-2">Cookies & local storage</h2>
            <p>
              This application may use browser local storage (e.g. to remember your pickup verification) 
              and essential cookies for authentication. We do not use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-amber-400 mb-2">Data security</h2>
            <p>
              We use appropriate technical and organisational measures to protect your personal data 
              against unauthorised access, loss, or misuse.
            </p>
          </section>

          <p className="text-zinc-500 text-xs pt-4">
            Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <Footer />
      </main>
    </div>
  )
}
