import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown } from "lucide-react";
import { MetaTags, pageMetaConfigs } from "@/components/seo/MetaTags";

export default function FAQ() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  const faqs = [
    {
      question: "What's different from traditional commodity exchanges?",
      answer: "Unlike traditional exchanges that focus on price discovery, Tutela emphasizes counterparty verification and end-to-end transaction security. We combine KYB verification, smart contracts, integrated payments, and logistics coordination in one platform. This reduces fraud risk and creates a more trusted trading environment for physical commodity deliveries."
    },
    {
      question: "How do you verify companies (KYB)?",
      answer: "Our Know Your Business (KYB) process includes comprehensive verification of business registration, ownership documentation, address confirmation, banking details, and tax registration. We use AI-powered document analysis to validate authenticity and cross-reference multiple data sources. The process typically takes 24-48 hours for complete verification."
    },
    {
      question: "Do I need a specific bank or logistics partner?",
      answer: "No, Tutela works with your existing banking and logistics relationships. However, we do have partnerships with verified providers that can offer enhanced integration and potentially better rates. You're free to use any legitimate financial institution or logistics provider that meets our basic verification requirements."
    },
    {
      question: "Where are my documents stored?",
      answer: "All documents are encrypted and stored securely in compliance with international data protection standards. You maintain full control over your documents - they're only accessible to you and, with your explicit permission, to verified counterparties during active negotiations. We never share your documents with third parties without your consent."
    },
    {
      question: "When will I get 'Verified' status?",
      answer: "Most businesses receive verified status within 24-48 hours after submitting complete documentation. Complex cases or international entities may take up to 5 business days. You'll receive real-time updates throughout the process, and our support team is available to help resolve any issues quickly."
    },
    {
      question: "What commodities can I trade on Tutela?",
      answer: "Tutela supports trading in fuel & hydrocarbons (crude oil, refined products), metals & precious metals (gold, silver, industrial metals), and agricultural products (grains, oils, etc.). We're continuously expanding our supported commodity categories based on user demand and market needs."
    },
    {
      question: "How does payment escrow work?",
      answer: "When you execute a contract, funds are held in a secure escrow account managed by smart contracts. Payments are released automatically based on predefined milestones (contract signing, shipping confirmation, delivery verification, etc.). This protects both buyers and sellers by ensuring payment security throughout the transaction lifecycle."
    },
    {
      question: "Can I cancel a contract after execution?",
      answer: "Contract cancellation terms are defined during negotiation and built into the smart contract. Standard contracts include provisions for cancellation under specific circumstances (force majeure, quality disputes, etc.) with associated penalties or procedures. All terms are transparent and agreed upon by both parties before execution."
    },
    {
      question: "What if there's a dispute during delivery?",
      answer: "Tutela includes built-in dispute resolution mechanisms. For quality disputes, we work with independent inspection services. For logistics issues, we coordinate with shipping partners. In case of unresolvable disputes, we have arbitration procedures and can engage legal experts. The escrow system protects funds until disputes are resolved."
    },
    {
      question: "Is Tutela available internationally?",
      answer: "Yes, Tutela supports international commodity trading. However, specific features and compliance requirements may vary by jurisdiction. We're continuously expanding our global coverage and working with local regulatory bodies to ensure full compliance in each market we serve."
    }
  ];

  return (
    <>
      <MetaTags {...pageMetaConfigs.faq} />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-neutral-50 to-white py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-neutral-900 mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-neutral-600 leading-relaxed">
              Get answers to common questions about Tutela's platform, 
              verification process, and trading features.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div 
                  key={index}
                  className="border border-neutral-200 rounded-lg overflow-hidden"
                >
                  <button
                    className="w-full px-6 py-4 text-left bg-white hover:bg-neutral-50 transition-colors"
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-neutral-900 pr-4">
                        {faq.question}
                      </h3>
                      <ChevronDown 
                        className={`w-5 h-5 text-neutral-500 transition-transform ${
                          openIndex === index ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>
                  
                  {openIndex === index && (
                    <div className="px-6 pb-4 bg-neutral-50">
                      <p className="text-neutral-700 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-20 bg-neutral-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-neutral-900 mb-6">
              Still Have Questions?
            </h2>
            <p className="text-lg text-neutral-600 mb-8">
              Our support team is here to help. Get in touch and we'll respond within 24 hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-emerald-600 hover:bg-emerald-700"
                asChild
              >
                <a href="mailto:support@tutela.com?subject=FAQ%20Question">
                  Contact Support
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                asChild
              >
                <Link href="/verification">
                  Start Verification
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Additional Resources */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-neutral-900 text-center mb-12">
              Additional Resources
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  How It Works
                </h3>
                <p className="text-neutral-600 mb-4">
                  Detailed walkthrough of the complete trading process from verification to delivery.
                </p>
                <Link href="/how-it-works" className="text-emerald-600 font-medium hover:text-emerald-700">
                  Learn More →
                </Link>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Pricing Plans
                </h3>
                <p className="text-neutral-600 mb-4">
                  Compare features and find the right plan for your trading volume and needs.
                </p>
                <Link href="/pricing" className="text-emerald-600 font-medium hover:text-emerald-700">
                  View Pricing →
                </Link>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm border border-neutral-200">
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  Try Demo
                </h3>
                <p className="text-neutral-600 mb-4">
                  Experience the platform with sample data before starting your verification.
                </p>
                <button 
                  onClick={() => {
                    const event = new CustomEvent('openDemoModal');
                    window.dispatchEvent(event);
                  }}
                  className="text-emerald-600 font-medium hover:text-emerald-700"
                >
                  Start Demo →
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}