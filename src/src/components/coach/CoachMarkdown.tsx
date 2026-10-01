import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { prepareMathMarkdown } from '../../lib/coach/mathText';

const REMARK = [remarkGfm, remarkMath];
// A half-streamed or mistyped formula shows as text instead of breaking the reply.
const REHYPE = [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]] as const;

/** Coach replies and documents: GitHub-flavoured Markdown (tables, task lists, code) plus LaTeX math. */
export function CoachMarkdown({ children }: { children: string }) {
    return (
        <ReactMarkdown remarkPlugins={REMARK} rehypePlugins={REHYPE as never}>
            {prepareMathMarkdown(children)}
        </ReactMarkdown>
    );
}
