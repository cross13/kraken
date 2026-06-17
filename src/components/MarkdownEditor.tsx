import Editor from 'react-simple-code-editor';
import { highlight } from '../lib/prism';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Lightweight Prism-highlighted editor for markdown spec files. Keeps the
 * keystroke responsiveness of a textarea but renders syntax tokens over it,
 * so the user sees real markdown structure (headings, lists, fenced code,
 * inline `code`, **bold**, etc.) as they type.
 */
export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  return (
    <div className="kraken-editor h-full overflow-auto px-8 py-6">
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={(code) => highlight(code, 'markdown')}
        padding={0}
        textareaClassName="!outline-none"
        textareaId="kraken-spec-editor"
        placeholder={placeholder}
        style={{
          minHeight: '100%',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          lineHeight: 'inherit',
        }}
      />
    </div>
  );
}
