import { STAMPS, type StampId } from './stamps';
type Actions = {
  state: () => object;
  add: (
    id: StampId,
    position?: { x: number; y: number },
    color?: string,
    palette?: number,
  ) => Promise<string | null>;
  export: () => Promise<boolean>;
};
type WebTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: WebTool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Expected an object.');
  return input as Record<string, unknown>;
}
export function registerEditorTools(actions: { current: Actions }) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const tools: WebTool[] = [
    {
      name: 'get_editor_state',
      description:
        'Read image dimensions, placed stamps, palettes and stamp catalog. Never returns the screenshot or its pixels.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (Object.keys(object(input)).length)
          throw new Error('No arguments expected.');
        return actions.current.state();
      },
    },
    {
      name: 'add_stamp',
      description:
        'Place one built-in stamp on the image already selected by the user. Coordinates are image pixels. This changes the visible editor; it does not export or share the image.',
      inputSchema: {
        type: 'object',
        properties: {
          stamp: { type: 'string', enum: STAMPS.map((s) => s.id) },
          x: { type: 'number', minimum: 0 },
          y: { type: 'number', minimum: 0 },
          color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          palette: { type: 'integer', minimum: 0, maximum: 3 },
        },
        required: ['stamp', 'x', 'y'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const o = object(input);
        if (
          Object.keys(o).some(
            (k) => !['stamp', 'x', 'y', 'color', 'palette'].includes(k),
          )
        )
          throw new Error('Unknown argument.');
        if (
          !STAMPS.some((s) => s.id === o.stamp) ||
          typeof o.x !== 'number' ||
          !Number.isFinite(o.x) ||
          o.x < 0 ||
          typeof o.y !== 'number' ||
          !Number.isFinite(o.y) ||
          o.y < 0
        )
          throw new Error('Invalid stamp or coordinates.');
        if (
          o.color !== undefined &&
          (typeof o.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(o.color))
        )
          throw new Error('Invalid color.');
        if (
          o.palette !== undefined &&
          (typeof o.palette !== 'number' ||
            !Number.isInteger(o.palette) ||
            o.palette < 0 ||
            o.palette > 3)
        )
          throw new Error('Invalid palette.');
        const state = actions.current.state() as {
          image?: { width: number; height: number };
        };
        if (!state.image) throw new Error('Select an image in the page first.');
        if (o.x > state.image.width || o.y > state.image.height)
          throw new Error('Coordinates outside the image.');
        const id = await actions.current.add(
          o.stamp as StampId,
          { x: o.x, y: o.y },
          o.color as string | undefined,
          o.palette as number | undefined,
        );
        if (!id)
          throw new Error('Stamp could not be added. The editor may be busy.');
        await settled();
        return { id, state: actions.current.state() };
      },
    },
    {
      name: 'prepare_export',
      description:
        'Flatten the current editor into a PNG and open its save preview. The user must choose download or share; this tool does neither.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (Object.keys(object(input)).length)
          throw new Error('No arguments expected.');
        if (!(await actions.current.export()))
          throw new Error('The image could not be prepared.');
        await settled();
        return { previewReady: true };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Progressive enhancement: manual editing remains available. */
    }
  }
  return () => lifecycle.abort();
}
