import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const components: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-extrabold tracking-tight text-text-strong mt-6 mb-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-extrabold tracking-tight text-text-strong mt-6 mb-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-semibold text-text-strong mt-5 mb-2">{children}</h3>,
  p: ({ children }) => <p className="text-text-muted mb-3 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text-strong">{children}</strong>,
  em: ({ children }) => <em className="text-text-muted">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-inside text-text-muted mb-3 space-y-1">{children}</ul>,
  li: ({ children }) => <li>{children}</li>,
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-accent/10">{children}</thead>,
  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
  th: ({ children }) => (
    <th className="text-left font-semibold text-text-strong px-3 py-2">{children}</th>
  ),
  td: ({ children }) => <td className="text-text-muted px-3 py-2">{children}</td>,
}

export default function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
