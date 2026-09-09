function digits(value: string, limit: number) {
  return value.replace(/\D/g, '').slice(0, limit);
}

export function maskCnpj(value: string) {
  return digits(value, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCpf(value: string) {
  return digits(value, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})(\d)/, '$1-$2');
}

export function maskPhone(value: string) {
  const valueDigits = digits(value, 11);
  if (valueDigits.length <= 10) {
    return valueDigits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return valueDigits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}
