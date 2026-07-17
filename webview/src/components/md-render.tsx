import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { postMessage } from '../apis/vscode';

interface MarkdownProps {
  children: string;
}

export const MdRender = memo(function MdRender({ children }: MarkdownProps) {
  return (
    <div className="entry-content-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (href) postMessage({ type: 'openExternal', url: href });
              }}>
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="md-code-block">{children}</pre>
          ),
          code: ({ className, children, ...props }) => {
            if (
              className?.startsWith('language-') ||
              className?.startsWith('hljs ')
            ) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
