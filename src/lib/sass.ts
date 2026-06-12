import * as sass from 'sass';

/** Thin wrapper around dart-sass. Throws sass.Exception on invalid input. */
export function compileScss(scss: string): string {
  return sass.compileString(scss).css;
}

export function isSassException(error: unknown): error is sass.Exception {
  return error instanceof sass.Exception;
}
