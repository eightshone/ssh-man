function validateServerName(input: string): boolean | string {
  // regex for allowed characters
  const allowedPattern: RegExp = /^[a-zA-Z0-9 \.:_\-]*$/;

  // check for allowed characters
  if (!allowedPattern.test(input)) {
    return "The string contains invalid characters.";
  }

  // check if the string starts or ends with invalid characters
  const invalidStartOrEndPattern: RegExp = /^[ \.:_\-]|[ \.:_\-]$/;
  if (invalidStartOrEndPattern.test(input)) {
    return "The string cannot start or end with spaces, dots, colons, dashes, or underscores.";
  }

  // if all validations pass
  return true;
}

export default validateServerName;
