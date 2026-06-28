import { validateCpfCnpj } from '../../shared/validators/cpfCnpjValidator';

describe('validateCpfCnpj', () => {
  describe('CPF válidos', () => {
    it('deve aceitar CPF válido sem formatação', () => {
      expect(validateCpfCnpj('11144477735')).toBe(true);
    });

    it('deve aceitar CPF válido formatado', () => {
      expect(validateCpfCnpj('111.444.777-35')).toBe(true);
    });

    it('deve aceitar outro CPF válido', () => {
      expect(validateCpfCnpj('529.982.247-25')).toBe(true);
    });
  });

  describe('CPF inválidos', () => {
    it('deve rejeitar CPF com todos dígitos iguais', () => {
      expect(validateCpfCnpj('111.111.111-11')).toBe(false);
    });

    it('deve rejeitar CPF com dígito verificador errado', () => {
      expect(validateCpfCnpj('111.444.777-34')).toBe(false);
    });

    it('deve rejeitar CPF com menos de 11 dígitos', () => {
      expect(validateCpfCnpj('1234567')).toBe(false);
    });
  });

  describe('CNPJ válidos', () => {
    it('deve aceitar CNPJ válido sem formatação', () => {
      expect(validateCpfCnpj('11222333000181')).toBe(true);
    });

    it('deve aceitar CNPJ válido formatado', () => {
      expect(validateCpfCnpj('11.222.333/0001-81')).toBe(true);
    });

    it('deve aceitar CNPJ da Petrobras', () => {
      expect(validateCpfCnpj('33.000.167/0001-01')).toBe(true);
    });
  });

  describe('CNPJ inválidos', () => {
    it('deve rejeitar CNPJ com todos dígitos iguais', () => {
      expect(validateCpfCnpj('11.111.111/1111-11')).toBe(false);
    });

    it('deve rejeitar CNPJ com dígito verificador errado', () => {
      expect(validateCpfCnpj('11.222.333/0001-82')).toBe(false);
    });

    it('deve rejeitar CNPJ com menos de 14 dígitos', () => {
      expect(validateCpfCnpj('1122233300018')).toBe(false);
    });
  });

  describe('Entradas inválidas', () => {
    it('deve rejeitar string vazia', () => {
      expect(validateCpfCnpj('')).toBe(false);
    });

    it('deve rejeitar string com apenas letras', () => {
      expect(validateCpfCnpj('abc.def.ghi-jk')).toBe(false);
    });
  });
});
