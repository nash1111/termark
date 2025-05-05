import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import fs from 'fs';
import path from 'path';
import { loadYoga } from 'yoga-layout/load';

const Yoga = await loadYoga();

enum EditorMode {
  EDIT = 'edit',
  VIEW = 'view',
  PREVIEW = 'preview'
}

const getMarkdownFiles = () => {
  const currentDir = process.cwd();
  const files = fs.readdirSync(currentDir);
  const markdownFiles = [];
  
  for (const file of files) {
    if (fs.statSync(path.join(currentDir, file)).isDirectory()) {
      try {
        const subFiles = fs.readdirSync(path.join(currentDir, file));
        for (const subFile of subFiles) {
          if (subFile.endsWith('.md')) {
            markdownFiles.push({
              label: `${file}/${subFile}`,
              value: path.join(currentDir, file, subFile)
            });
          }
        }
      } catch (error) {
      }
    } else if (file.endsWith('.md')) {
      markdownFiles.push({
        label: file,
        value: path.join(currentDir, file)
      });
    }
  }
  
  return markdownFiles;
};

const FileSelector = ({ onSelect }: { onSelect: (filePath: string) => void }) => {
  const items = getMarkdownFiles();
  
  if (items.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No markdown files found.</Text>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column">
      <Text>Select a markdown file:</Text>
      <SelectInput 
        items={items} 
        onSelect={(item: { value: string }) => onSelect(item.value)} 
      />
    </Box>
  );
};

const MarkdownEditor = ({ filePath }: { filePath: string }) => {
  const { exit } = useApp();
  const [content, setContent] = useState('');
  const [cursor, setCursor] = useState({ line: 0, column: 0 });
  const [modified, setModified] = useState(false);
  const [mode, setMode] = useState<EditorMode>(EditorMode.EDIT);

  useEffect(() => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading file:', err);
        return;
      }
      setContent(data);
    });
  }, [filePath]);

  useInput((input, key) => {
    if (key.escape) {
      // modes cycle : EDIT -> VIEW -> PREVIEW -> EDIT
      setMode(prevMode => {
        if (prevMode === EditorMode.EDIT) return EditorMode.VIEW;
        if (prevMode === EditorMode.VIEW) return EditorMode.PREVIEW;
        return EditorMode.EDIT;
      });
      return;
    }
    
    if (mode !== EditorMode.EDIT) {
      return;
    }
    
    if (key.ctrl && input === 's') {
      fs.writeFile(filePath, content, (err) => {
        if (err) {
          console.error('Error saving file:', err);
        }
        exit();
      });
    } else if (key.ctrl && input === 'q') {
      exit();
    } else if (key.return) {
      setContent((prev) => {
        const lines = prev.split('\n');
        lines.splice(cursor.line + 1, 0, '');
        return lines.join('\n');
      });
      setCursor((prev) => ({ line: prev.line + 1, column: 0 }));
      setModified(true);
    } else if (key.backspace || key.delete) {
      setContent((prev) => {
        const lines = prev.split('\n');
        const line = lines[cursor.line];
        if (line && cursor.column > 0) {
          lines[cursor.line] =
            line.slice(0, cursor.column - 1) + line.slice(cursor.column);
          setCursor((prev) => ({
            line: prev.line,
            column: prev.column - 1,
          }));
        }
        return lines.join('\n');
      });
      setModified(true);
    } else if (key.upArrow) {
      setCursor((prev) => ({
        line: Math.max(0, prev.line - 1),
        column: Math.min(prev.column, (content.split('\n')[Math.max(0, prev.line - 1)] || '').length)
      }));
    } else if (key.downArrow) {
      const lines = content.split('\n');
      setCursor((prev) => ({
        line: Math.min(lines.length - 1, prev.line + 1),
        column: Math.min(prev.column, (lines[Math.min(lines.length - 1, prev.line + 1)] || '').length)
      }));
    } else if (key.leftArrow) {
      setCursor((prev) => {
        if (prev.column > 0) {
          return { line: prev.line, column: prev.column - 1 };
        } else if (prev.line > 0) {
          const prevLineLength = (content.split('\n')[prev.line - 1] || '').length;
          return { line: prev.line - 1, column: prevLineLength };
        }
        return prev;
      });
    } else if (key.rightArrow) {
      const lines = content.split('\n');
      setCursor((prev) => {
        const currentLine = lines[prev.line] || '';
        if (prev.column < currentLine.length) {
          return { line: prev.line, column: prev.column + 1 };
        } else if (prev.line < lines.length - 1) {
          return { line: prev.line + 1, column: 0 };
        }
        return prev;
      });
    } else if (input) {
      setContent((prev) => {
        const lines = prev.split('\n');
        const line = lines[cursor.line] || '';
        lines[cursor.line] =
          line.slice(0, cursor.column) + input + line.slice(cursor.column);
        return lines.join('\n');
      });
      setCursor((prev) => ({
        line: prev.line,
        column: prev.column + 1,
      }));
      setModified(true);
    }
  });

  const renderMarkdownPreview = (line: string) => {
    if (line.startsWith('# ')) {
      return (
        <Box>
          <Text bold color="blue" backgroundColor="black" wrap="wrap">
            {line.substring(2)}
          </Text>
        </Box>
      );
    } else if (line.startsWith('## ')) {
      return (
        <Box paddingLeft={1}>
          <Text bold color="cyan" wrap="wrap">
            {line.substring(3)}
          </Text>
        </Box>
      );
    } else if (line.startsWith('### ')) {
      return <Box paddingLeft={2}><Text bold color="green" wrap="wrap">{line.substring(4)}</Text></Box>;
    } else if (line.startsWith('#### ')) {
      return <Box paddingLeft={4}><Text color="yellow" wrap="wrap">{line.substring(5)}</Text></Box>;
    } else if (line.startsWith('- ')) {
      return <Text wrap="wrap">  • {line.substring(2)}</Text>;
    } else {
      return <Text wrap="wrap">{line}</Text>;
    }
  };

  const lines = content.split('\n');

  const renderContent = () => {
    switch (mode) {
      case EditorMode.EDIT:
        return (
          <Box flexDirection="column">
            {lines.map((line, index) => (
              <Box key={index} flexDirection="row">
                <Box width={4}><Text color="gray" dimColor>{index + 1}</Text></Box>
                <Text>
                  {index === cursor.line
                    ? (
                        line.length === 0
                          ? '█'
                          : cursor.column === line.length
                            ? line + '█'
                            : line.slice(0, cursor.column) + '█' + line.slice(cursor.column + 1)
                      )
                    : line}
                </Text>
              </Box>
            ))}
          </Box>
        );
      
      case EditorMode.VIEW:
        return (
          <Box flexDirection="column">
            {lines.map((line, index) => (
              <Box key={index} flexDirection="row">
                <Box width={4}><Text color="gray" dimColor>{index + 1}</Text></Box>
                <Text>{line}</Text>
              </Box>
            ))}
          </Box>
        );
      
      case EditorMode.PREVIEW:
        return (
          <Box flexDirection="column">
            {lines.map((line, index) => (
              <Box key={index} flexDirection="row">
                <Box width={4}><Text color="gray" dimColor>{index + 1}</Text></Box>
                <Box flexGrow={1}>
                  {renderMarkdownPreview(line)}
                </Box>
              </Box>
            ))}
          </Box>
        );
    }
  };

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" padding={1} width={80} height={20} flexDirection="column">
        {renderContent()}
      </Box>
      <Box>
        <Text>
          Mode: <Text color="green" bold>{mode.toUpperCase()}</Text> | 
          Line: {cursor.line + 1}, Column: {cursor.column + 1}{' '}
          {modified ? '(modified)' : ''}
        </Text>
      </Box>
      <Box>
        <Text>
          Press <Text bold>ESC</Text> to switch modes, <Text bold>Ctrl+S</Text> to save and exit, <Text bold>Ctrl+Q</Text> to exit without saving.
        </Text>
      </Box>
    </Box>
  );
};

const App = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  if (!selectedFile) {
    return <FileSelector onSelect={setSelectedFile} />;
  }
  
  return <MarkdownEditor filePath={selectedFile} />;
};

render(<App />);
