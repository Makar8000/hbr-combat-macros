// Dumps every class, field and method name from the game's IL2CPP global-metadata.dat (version 31).
// Reads the file only. Usage: bun run scan:metadata [path-to-global-metadata.dat] [output-file]
//
// The metadata has names, but NOT instance field offsets or field types. Those live in GameAssembly.dll.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DEFAULT_METADATA = "E:/Program Files/YostarGames/HeavenBurnsRed/HeavenBurnsRed_Data/il2cpp_data/Metadata/global-metadata.dat";
const metadataPath = process.argv[2] ?? DEFAULT_METADATA;
const outputPath = process.argv[3] ?? "scanner/out/metadata-dump.txt";

const bytes = readFileSync(metadataPath);
const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const i32 = (at: number) => dv.getInt32(at, true);
const u16 = (at: number) => dv.getUint16(at, true);

if (dv.getUint32(0, true) !== 0xfab11baf) throw new Error("Not an IL2CPP metadata file (bad magic)");
const version = i32(4);
if (version !== 31) throw new Error(`Only metadata version 31 is supported, got ${version}`);

// After the magic and version the header is a list of (offset, size) pairs, in this order.
const SECTIONS = [
  "stringLiteral",
  "stringLiteralData",
  "string",
  "events",
  "properties",
  "methods",
  "parameterDefaultValues",
  "fieldDefaultValues",
  "fieldAndParameterDefaultValueData",
  "fieldMarshaledSizes",
  "parameters",
  "fields",
  "genericParameters",
  "genericParameterConstraints",
  "genericContainers",
  "nestedTypes",
  "interfaces",
  "vtableMethods",
  "interfaceOffsets",
  "typeDefinitions",
  "images",
  "assemblies",
] as const;
const section = (name: (typeof SECTIONS)[number]) => {
  const at = 8 + SECTIONS.indexOf(name) * 8;
  return { offset: i32(at), size: i32(at + 4) };
};

const decoder = new TextDecoder();
const strings = section("string");
function str(index: number): string {
  const start = strings.offset + index;
  let end = start;
  while (bytes[end] !== 0) end++;
  return decoder.decode(bytes.subarray(start, end));
}

// Record sizes in bytes. A wrong size shows up as a section size that doesn't divide evenly.
const TYPE_SIZE = 88;
const FIELD_SIZE = 12;
const METHOD_SIZE = 36;
const IMAGE_SIZE = 40;
for (const [name, size] of [
  ["typeDefinitions", TYPE_SIZE],
  ["fields", FIELD_SIZE],
  ["methods", METHOD_SIZE],
  ["images", IMAGE_SIZE],
] as const) {
  if (section(name).size % size !== 0) throw new Error(`${name} size ${section(name).size} is not a multiple of ${size}`);
}

const types = section("typeDefinitions");
const fields = section("fields");
const methods = section("methods");
const images = section("images");

const lines: string[] = [];
let typeCount = 0;
let fieldCount = 0;
let methodCount = 0;

for (let img = 0; img < images.size / IMAGE_SIZE; img++) {
  const at = images.offset + img * IMAGE_SIZE;
  const typeStart = i32(at + 8);
  const typeEnd = typeStart + i32(at + 12);
  lines.push(`\n==== ${str(i32(at))} ====`);

  for (let t = typeStart; t < typeEnd; t++) {
    const tat = types.offset + t * TYPE_SIZE;
    const ns = str(i32(tat + 4));
    lines.push(`\n${ns ? ns + "." : ""}${str(i32(tat))}`);
    typeCount++;

    // Counts are u16 values after the 16 int32 fields (64 bytes): methods, properties, fields, ...
    const fieldStart = i32(tat + 32);
    const methodStart = i32(tat + 36);
    const methodsInType = u16(tat + 64);
    const fieldsInType = u16(tat + 68);

    for (let f = fieldStart; f < fieldStart + fieldsInType; f++) {
      lines.push(`  field  ${str(i32(fields.offset + f * FIELD_SIZE))}`);
      fieldCount++;
    }
    for (let m = methodStart; m < methodStart + methodsInType; m++) {
      lines.push(`  method ${str(i32(methods.offset + m * METHOD_SIZE))}`);
      methodCount++;
    }
  }
}

mkdirSync(outputPath.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
writeFileSync(outputPath, lines.join("\n") + "\n");
console.log(`Wrote ${typeCount} types, ${fieldCount} fields, ${methodCount} methods to ${outputPath}`);
