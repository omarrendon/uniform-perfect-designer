declare module 'use-image' {
  export default function useImage(
    url: string,
    crossOrigin?: string
  ): [HTMLImageElement | undefined, 'loading' | 'loaded' | 'failed'];
}
