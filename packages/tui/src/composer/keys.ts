export function isPrintableInput(
  character: string,
  key: { ctrl?: boolean; meta?: boolean },
): boolean {
  return character.length > 0 && !key.ctrl && !key.meta && !/[\r\n\t]/.test(character)
}
