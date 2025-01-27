function compareVersions(version1, version2) {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);

  const maxLength = Math.max(v1Parts.length, v2Parts.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = v1Parts[i] || 0; // default to 0 if part is missing
    const part2 = v2Parts[i] || 0;

    if (part1 > part2) {
      return 1; // version 1 is greater
    }
    if (part1 < part2) {
      return -1; // version 2 is greater
    }
  }

  return 0; // both versions are equal
}

export default compareVersions;
