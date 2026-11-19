/** PDPA: 6730201123 → 6730201xxx */
export const maskCode = (code: string) => (code.length > 3 ? code.slice(0, -3) + "xxx" : "xxx");
export const maskPhone = (p?: string | null) => (p ? p.slice(0, 3) + "-xxx-" + p.slice(-2) : "-");
