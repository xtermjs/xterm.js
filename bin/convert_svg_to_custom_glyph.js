/**
 * Converts an SVG file as exported by fontforge into the SVG-like format as expected by the custom
 * glyph rasterizer.
 *
 * Usage: node convert_svg_to_custom_glyph.js <svg-file-or-folder>
 */

const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node convert_svg_to_custom_glyph.js <svg-file-or-folder>');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), input);
const stat = fs.statSync(inputPath);
const files = stat.isDirectory()
  ? fs.readdirSync(inputPath).filter(f => f.endsWith('.svg')).map(f => path.join(inputPath, f))
  : [inputPath];

if (files.length === 0) {
  console.error('No SVG files found');
  process.exit(1);
}

for (const file of files) {
  console.log(`\n${'='.repeat(60)}\nProcessing: ${path.basename(file)}\n${'='.repeat(60)}`);
  processFile(file);
}

function processFile(filePath) {
  // Get file content
  const content = fs.readFileSync(filePath, 'utf8');

  // Get viewBox
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) {
    console.error('No viewBox found in SVG');
    return;
  }
  const [minX, minY, width, height] = viewBoxMatch[1].split(/\s+/).map(Number);
  console.log(`ViewBox: ${minX} ${minY} ${width} ${height}`);

  // Get path `d` property
  const pathMatch = content.match(/<path[^>]*\sd="([^"]+)"/);
  if (!pathMatch) {
    console.error('No path d attribute found in SVG');
    return;
  }
  const originalPath = pathMatch[1].replace(/\s+/g, ' ').trim();
  console.log(`\nOriginal path length: ${originalPath.length} chars`);

  // Parse path into commands
  function parsePath(d) {
  const commands = [];
  const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  let match;
  while ((match = regex.exec(d)) !== null) {
    const cmd = match[1];
    const argsStr = match[2].trim();
    const args = argsStr ? argsStr.split(/[\s,]+/).map(Number) : [];
    commands.push({ cmd, args });
  }
  return commands;
}

// Convert relative commands to absolute and expand T/S to Q/C
function toAbsolute(commands) {
  const result = [];
  let x = 0, y = 0; // Current position
  let startX = 0, startY = 0; // Start of current subpath
  let lastControlX = 0, lastControlY = 0; // Last control point for T/S
  let lastCmd = '';

  for (const { cmd, args } of commands) {
    const isRelative = cmd === cmd.toLowerCase();
    const absCmd = cmd.toUpperCase();

    switch (absCmd) {
      case 'M': {
        // MoveTo: M x y (or m dx dy)
        const absArgs = [];
        for (let i = 0; i < args.length; i += 2) {
          const newX = isRelative ? x + args[i] : args[i];
          const newY = isRelative ? y + args[i + 1] : args[i + 1];
          absArgs.push(newX, newY);
          x = newX;
          y = newY;
          if (i === 0) {
            startX = x;
            startY = y;
          }
        }
        lastControlX = x;
        lastControlY = y;
        result.push({ cmd: 'M', args: absArgs });
        break;
      }
      case 'L': {
        // LineTo: L x y (or l dx dy)
        const absArgs = [];
        for (let i = 0; i < args.length; i += 2) {
          const newX = isRelative ? x + args[i] : args[i];
          const newY = isRelative ? y + args[i + 1] : args[i + 1];
          absArgs.push(newX, newY);
          x = newX;
          y = newY;
        }
        lastControlX = x;
        lastControlY = y;
        result.push({ cmd: 'L', args: absArgs });
        break;
      }
      case 'H': {
        // Horizontal LineTo - convert to L
        for (let i = 0; i < args.length; i++) {
          const newX = isRelative ? x + args[i] : args[i];
          result.push({ cmd: 'L', args: [newX, y] });
          x = newX;
        }
        lastControlX = x;
        lastControlY = y;
        break;
      }
      case 'V': {
        // Vertical LineTo - convert to L
        for (let i = 0; i < args.length; i++) {
          const newY = isRelative ? y + args[i] : args[i];
          result.push({ cmd: 'L', args: [x, newY] });
          y = newY;
        }
        lastControlX = x;
        lastControlY = y;
        break;
      }
      case 'C': {
        // CurveTo: C x1 y1 x2 y2 x y (or c dx1 dy1 dx2 dy2 dx dy)
        const absArgs = [];
        for (let i = 0; i < args.length; i += 6) {
          const x1 = isRelative ? x + args[i] : args[i];
          const y1 = isRelative ? y + args[i + 1] : args[i + 1];
          const x2 = isRelative ? x + args[i + 2] : args[i + 2];
          const y2 = isRelative ? y + args[i + 3] : args[i + 3];
          const newX = isRelative ? x + args[i + 4] : args[i + 4];
          const newY = isRelative ? y + args[i + 5] : args[i + 5];
          absArgs.push(x1, y1, x2, y2, newX, newY);
          lastControlX = x2;
          lastControlY = y2;
          x = newX;
          y = newY;
        }
        result.push({ cmd: 'C', args: absArgs });
        break;
      }
      case 'S': {
        // Smooth CurveTo - expand to C
        for (let i = 0; i < args.length; i += 4) {
          // Reflect last control point
          let x1, y1;
          if (lastCmd === 'C' || lastCmd === 'S') {
            x1 = 2 * x - lastControlX;
            y1 = 2 * y - lastControlY;
          } else {
            x1 = x;
            y1 = y;
          }
          const x2 = isRelative ? x + args[i] : args[i];
          const y2 = isRelative ? y + args[i + 1] : args[i + 1];
          const newX = isRelative ? x + args[i + 2] : args[i + 2];
          const newY = isRelative ? y + args[i + 3] : args[i + 3];
          result.push({ cmd: 'C', args: [x1, y1, x2, y2, newX, newY] });
          lastControlX = x2;
          lastControlY = y2;
          x = newX;
          y = newY;
        }
        break;
      }
      case 'Q': {
        // Quadratic CurveTo: Q x1 y1 x y (or q dx1 dy1 dx dy)
        const absArgs = [];
        for (let i = 0; i < args.length; i += 4) {
          const x1 = isRelative ? x + args[i] : args[i];
          const y1 = isRelative ? y + args[i + 1] : args[i + 1];
          const newX = isRelative ? x + args[i + 2] : args[i + 2];
          const newY = isRelative ? y + args[i + 3] : args[i + 3];
          absArgs.push(x1, y1, newX, newY);
          lastControlX = x1;
          lastControlY = y1;
          x = newX;
          y = newY;
        }
        result.push({ cmd: 'Q', args: absArgs });
        break;
      }
      case 'T': {
        // Smooth Quadratic CurveTo - keep as T
        const absArgs = [];
        for (let i = 0; i < args.length; i += 2) {
          // Reflect last control point for tracking
          let cpX, cpY;
          if (lastCmd === 'Q' || lastCmd === 'T') {
            cpX = 2 * x - lastControlX;
            cpY = 2 * y - lastControlY;
          } else {
            cpX = x;
            cpY = y;
          }
          const newX = isRelative ? x + args[i] : args[i];
          const newY = isRelative ? y + args[i + 1] : args[i + 1];
          absArgs.push(newX, newY);
          lastControlX = cpX;
          lastControlY = cpY;
          x = newX;
          y = newY;
          lastCmd = 'T'; // For chained T commands
        }
        result.push({ cmd: 'T', args: absArgs });
        break;
      }
      case 'A': {
        // Arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
        const absArgs = [];
        for (let i = 0; i < args.length; i += 7) {
          const rx = args[i];
          const ry = args[i + 1];
          const rotation = args[i + 2];
          const largeArc = args[i + 3];
          const sweep = args[i + 4];
          const newX = isRelative ? x + args[i + 5] : args[i + 5];
          const newY = isRelative ? y + args[i + 6] : args[i + 6];
          absArgs.push(rx, ry, rotation, largeArc, sweep, newX, newY);
          x = newX;
          y = newY;
        }
        lastControlX = x;
        lastControlY = y;
        result.push({ cmd: 'A', args: absArgs });
        break;
      }
      case 'Z': {
        // ClosePath
        x = startX;
        y = startY;
        lastControlX = x;
        lastControlY = y;
        result.push({ cmd: 'Z', args: [] });
        break;
      }
    }

    if (absCmd !== 'T') {
      lastCmd = absCmd;
    }
  }

  return result;
}

// Scale coordinates to 0-1 range
function scaleToNormalized(commands, minX, minY, width, height) {
  function scaleX(val) {
    return (val - minX) / width;
  }
  function scaleY(val) {
    return (val - minY) / height;
  }
  function scaleRx(val) {
    return val / width;
  }
  function scaleRy(val) {
    return val / height;
  }

  const result = [];
  for (const { cmd, args } of commands) {
    const scaledArgs = [];

    switch (cmd) {
      case 'M':
      case 'L':
      case 'T': {
        for (let i = 0; i < args.length; i += 2) {
          scaledArgs.push(scaleX(args[i]), scaleY(args[i + 1]));
        }
        break;
      }
      case 'H': {
        for (let i = 0; i < args.length; i++) {
          scaledArgs.push(scaleX(args[i]));
        }
        break;
      }
      case 'V': {
        for (let i = 0; i < args.length; i++) {
          scaledArgs.push(scaleY(args[i]));
        }
        break;
      }
      case 'C': {
        for (let i = 0; i < args.length; i += 6) {
          scaledArgs.push(
            scaleX(args[i]), scaleY(args[i + 1]),
            scaleX(args[i + 2]), scaleY(args[i + 3]),
            scaleX(args[i + 4]), scaleY(args[i + 5])
          );
        }
        break;
      }
      case 'S':
      case 'Q': {
        for (let i = 0; i < args.length; i += 4) {
          scaledArgs.push(
            scaleX(args[i]), scaleY(args[i + 1]),
            scaleX(args[i + 2]), scaleY(args[i + 3])
          );
        }
        break;
      }
      case 'A': {
        for (let i = 0; i < args.length; i += 7) {
          // rx, ry need to be scaled; rotation and flags stay the same
          scaledArgs.push(
            scaleRx(args[i]),     // rx
            scaleRy(args[i + 1]), // ry
            args[i + 2],          // rotation
            args[i + 3],          // large-arc
            args[i + 4],          // sweep
            scaleX(args[i + 5]),  // x
            scaleY(args[i + 6])   // y
          );
        }
        break;
      }
      case 'Z': {
        // No args
        break;
      }
    }

    result.push({ cmd, args: scaledArgs });
  }

  return result;
}

// Format number to reasonable precision
function formatNum(n, precision = 4) {
  const rounded = Number(n.toFixed(precision));
  return String(rounded);
}

// Convert commands back to path string
function commandsToPath(commands) {
  return commands.map(({ cmd, args }, i) => {
    const prefix = i === 0 ? '' : ' ';
    if (args.length === 0) return prefix + cmd;
    return prefix + cmd + args.map(a => formatNum(a)).join(',');
  }).join('');
}

  // Main conversion
  const parsed = parsePath(originalPath);
  const absolute = toAbsolute(parsed);

  // Calculate actual bounding box from path data
  function getBoundingBox(commands) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const { cmd, args } of commands) {
    switch (cmd) {
      case 'M':
      case 'L':
      case 'T': {
        for (let i = 0; i < args.length; i += 2) {
          minX = Math.min(minX, args[i]);
          maxX = Math.max(maxX, args[i]);
          minY = Math.min(minY, args[i + 1]);
          maxY = Math.max(maxY, args[i + 1]);
        }
        break;
      }
      case 'H': {
        for (let i = 0; i < args.length; i++) {
          minX = Math.min(minX, args[i]);
          maxX = Math.max(maxX, args[i]);
        }
        break;
      }
      case 'V': {
        for (let i = 0; i < args.length; i++) {
          minY = Math.min(minY, args[i]);
          maxY = Math.max(maxY, args[i]);
        }
        break;
      }
      case 'C': {
        for (let i = 0; i < args.length; i += 6) {
          // Include control points and endpoint
          minX = Math.min(minX, args[i], args[i + 2], args[i + 4]);
          maxX = Math.max(maxX, args[i], args[i + 2], args[i + 4]);
          minY = Math.min(minY, args[i + 1], args[i + 3], args[i + 5]);
          maxY = Math.max(maxY, args[i + 1], args[i + 3], args[i + 5]);
        }
        break;
      }
      case 'S':
      case 'Q': {
        for (let i = 0; i < args.length; i += 4) {
          minX = Math.min(minX, args[i], args[i + 2]);
          maxX = Math.max(maxX, args[i], args[i + 2]);
          minY = Math.min(minY, args[i + 1], args[i + 3]);
          maxY = Math.max(maxY, args[i + 1], args[i + 3]);
        }
        break;
      }
      case 'A': {
        for (let i = 0; i < args.length; i += 7) {
          minX = Math.min(minX, args[i + 5]);
          maxX = Math.max(maxX, args[i + 5]);
          minY = Math.min(minY, args[i + 6]);
          maxY = Math.max(maxY, args[i + 6]);
        }
        break;
      }
    }
  }

  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

  const bbox = getBoundingBox(absolute);
  console.log(`Path bounding box: x=${bbox.minX}, y=${bbox.minY}, w=${bbox.width}, h=${bbox.height}`);

  // Use path bounding box for normalization
  const normalized = scaleToNormalized(absolute, bbox.minX, bbox.minY, bbox.width, bbox.height);
  const result = commandsToPath(normalized);

  console.log(`\nConverted path (${result.length} chars):\n`);
  console.log(result);

  console.log(`\n\nFor CustomGlyphDefinitions.ts:\n`);
  console.log(`'\\u{E0C0}': { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: { d: '${result}', type: CustomGlyphVectorType.FILL } },`);

  // Write output file
  const ext = path.extname(filePath);
  const outputPath = filePath.replace(ext, `_output${ext}`);
  const svgOutput = `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 1 1">
  <path fill="currentColor" d="${result}" />
</svg>
`;
  fs.writeFileSync(outputPath, svgOutput, 'utf8');
  console.log(`\nOutput written to: ${outputPath}`);
}
