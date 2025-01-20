function normalizeServerName(name: string): string {
  return name.toLowerCase().replaceAll(" ", "-");
}
