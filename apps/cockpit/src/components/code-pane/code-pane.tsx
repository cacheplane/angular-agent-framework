import React from 'react';
import { CodeMode } from '../code-mode/code-mode';

interface CodePaneProps {
  paths: string[];
}

export function CodePane({ paths }: CodePaneProps) {
  return <CodeMode entryTitle="Implementation files" codeAssetPaths={paths} />;
}
