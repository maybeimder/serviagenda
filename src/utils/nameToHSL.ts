function nameToHue(fullName: string): number {
      const cleanName = fullName.trim().toLowerCase();
      let hash = 0;

      for (let i = 0; i < cleanName.length; i++) {
            hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
      }

      return Math.abs(hash) % 360;
}

export function nameToHslColor( fullName: string, saturation = 40, lightness = 60 ): string {
      return `hsl(${nameToHue(fullName)}, ${saturation}%, ${lightness}%)`;
}

export function nameToHslGradient( fullName: string, saturation = 60, lightness = 60 ): string {
      const hue = nameToHue(fullName);
      const shift = -20 * Math.cos(((hue - 60) * Math.PI) / 180);
      const variantHue = (hue + shift + 360) % 360;

      const base = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      const variant = `hsl(${variantHue.toFixed(0)}, ${saturation + 3}%, ${lightness - 1}%)`;
      return `linear-gradient(180deg, ${base}, ${variant})`;
}
