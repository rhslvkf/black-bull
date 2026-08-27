export interface DecodedPng { width: number; height: number; channels: number; data: Buffer }
export interface PixelStats { distinct: number; modalShare: number; inkShare: number }
export declare function decodePng(buf: Buffer): DecodedPng
export declare function analyzePixels(png: DecodedPng): PixelStats
export declare function isBlank(pixels: PixelStats): boolean
export declare const PIXEL_MIN_DISTINCT: number
export declare const PIXEL_MIN_INK: number
export declare const INK_LUMINANCE_DELTA: number
