import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Converte R$ para centavos
const r = (valor) => Math.round(valor * 100);

// Dados da tabela TodoBrasil — origem São Bento do Sul/SC (Interior 1)
// FP em R$, por faixa: [0-30kg, 30-50kg, 50-70kg, 70-100kg], preco_kg_excedente
const REGIOES_TODOBRASIL = [
  // NORTE
  { nome: 'Rio Branco', uf: 'AC', regiao: 'NORTE', prazo: [17,19], fp: [238.36, 280.42, 329.91, 388.13], exc: 3.38, adv: 0.91, gris: 0.22 },
  { nome: 'Interior 0', uf: 'AC', regiao: 'NORTE', prazo: [17,19], fp: [262.19, 308.46, 362.90, 426.94], exc: 3.71, adv: 1.00, gris: 0.22 },
  { nome: 'Interior 1', uf: 'AC', regiao: 'NORTE', prazo: [22,24], fp: [357.54, 420.63, 494.86, 582.19], exc: 5.06, adv: 1.37, gris: 0.22 },
  { nome: 'Interior 2', uf: 'AC', regiao: 'NORTE', prazo: [23,25], fp: [417.13, 490.74, 577.34, 679.22], exc: 5.91, adv: 1.59, gris: 0.22 },
  { nome: 'Interior 3', uf: 'AC', regiao: 'NORTE', prazo: [24,26], fp: [476.71, 560.84, 659.81, 776.25], exc: 6.75, adv: 1.82, gris: 0.22 },

  { nome: 'Manaus', uf: 'AM', regiao: 'NORTE', prazo: [19,21], fp: [225.64, 265.46, 312.31, 367.43], exc: 3.20, adv: 0.91, gris: 0.22 },
  { nome: 'Interior 0', uf: 'AM', regiao: 'NORTE', prazo: [19,21], fp: [248.21, 292.01, 343.54, 404.17], exc: 3.51, adv: 1.00, gris: 0.22 },
  { nome: 'Interior 1', uf: 'AM', regiao: 'NORTE', prazo: [27,29], fp: [401.78, 446.42, 496.02, 551.14], exc: 4.79, adv: 1.37, gris: 0.22 },
  { nome: 'Interior 2', uf: 'AM', regiao: 'NORTE', prazo: [28,30], fp: [468.74, 520.82, 578.69, 642.99], exc: 5.59, adv: 1.59, gris: 0.22 },
  { nome: 'Interior 3', uf: 'AM', regiao: 'NORTE', prazo: [29,31], fp: [535.71, 595.23, 661.37, 734.85], exc: 6.39, adv: 1.82, gris: 0.22 },

  { nome: 'Macapá', uf: 'AP', regiao: 'NORTE', prazo: [18,20], fp: [206.58, 243.03, 285.92, 336.38], exc: 2.93, adv: 0.91, gris: 0.22 },
  { nome: 'Interior 0', uf: 'AP', regiao: 'NORTE', prazo: [18,20], fp: [227.23, 267.33, 314.51, 370.01], exc: 3.22, adv: 1.00, gris: 0.22 },
  { nome: 'Interior 1', uf: 'AP', regiao: 'NORTE', prazo: [23,25], fp: [367.83, 408.70, 454.11, 504.56], exc: 4.39, adv: 1.37, gris: 0.22 },
  { nome: 'Interior 2', uf: 'AP', regiao: 'NORTE', prazo: [24,26], fp: [429.13, 476.81, 529.79, 588.66], exc: 5.12, adv: 1.59, gris: 0.22 },
  { nome: 'Interior 3', uf: 'AP', regiao: 'NORTE', prazo: [25,27], fp: [490.43, 544.93, 605.48, 672.75], exc: 5.85, adv: 1.82, gris: 0.22 },

  { nome: 'Belém', uf: 'PA', regiao: 'NORTE', prazo: [13,15], fp: [174.80, 205.64, 241.93, 284.63], exc: 2.48, adv: 0.91, gris: 0.22 },
  { nome: 'Interior 0', uf: 'PA', regiao: 'NORTE', prazo: [13,15], fp: [192.27, 226.21, 266.12, 313.09], exc: 2.72, adv: 1.00, gris: 0.22 },
  { nome: 'Interior 1', uf: 'PA', regiao: 'NORTE', prazo: [21,23], fp: [311.24, 345.82, 384.24, 426.94], exc: 3.71, adv: 1.37, gris: 0.22 },
  { nome: 'Interior 2', uf: 'PA', regiao: 'NORTE', prazo: [23,25], fp: [363.11, 403.46, 448.28, 498.09], exc: 4.33, adv: 1.59, gris: 0.22 },
  { nome: 'Interior 3', uf: 'PA', regiao: 'NORTE', prazo: [24,26], fp: [414.98, 461.09, 512.33, 569.25], exc: 4.95, adv: 1.82, gris: 0.22 },

  { nome: 'Porto Velho', uf: 'RO', regiao: 'NORTE', prazo: [15,17], fp: [230.41, 271.07, 318.91, 375.19], exc: 3.26, adv: 0.91, gris: 0.22 },
  { nome: 'Interior 0', uf: 'RO', regiao: 'NORTE', prazo: [15,17], fp: [253.45, 298.18, 350.80, 412.71], exc: 3.59, adv: 1.00, gris: 0.22 },
  { nome: 'Interior 1', uf: 'RO', regiao: 'NORTE', prazo: [20,22], fp: [345.62, 406.61, 478.36, 562.78], exc: 4.89, adv: 1.37, gris: 0.22 },
  { nome: 'Interior 2', uf: 'RO', regiao: 'NORTE', prazo: [21,23], fp: [403.22, 474.38, 558.09, 656.58], exc: 5.71, adv: 1.59, gris: 0.22 },
  { nome: 'Interior 3', uf: 'RO', regiao: 'NORTE', prazo: [22,24], fp: [460.82, 542.15, 637.82, 750.38], exc: 6.53, adv: 1.82, gris: 0.22 },

  { nome: 'Boa Vista', uf: 'RR', regiao: 'NORTE', prazo: [24,26], fp: [250.28, 294.44, 346.40, 407.53], exc: 3.54, adv: 0.91, gris: 0.22 },
  { nome: 'Interior 1', uf: 'RR', regiao: 'NORTE', prazo: [30,32], fp: [375.41, 441.66, 519.60, 611.30], exc: 5.32, adv: 1.37, gris: 0.22 },
  { nome: 'Interior 2', uf: 'RR', regiao: 'NORTE', prazo: [31,33], fp: [437.98, 515.27, 606.20, 713.18], exc: 6.20, adv: 1.59, gris: 0.22 },
  { nome: 'Interior 3', uf: 'RR', regiao: 'NORTE', prazo: [32,34], fp: [500.55, 588.88, 692.80, 815.06], exc: 7.09, adv: 1.82, gris: 0.22 },

  { nome: 'Palmas', uf: 'TO', regiao: 'NORTE', prazo: [12,14], fp: [166.85, 196.29, 230.93, 271.69], exc: 2.36, adv: 0.91, gris: 0.22 },
  { nome: 'Interior 1', uf: 'TO', regiao: 'NORTE', prazo: [17,19], fp: [250.28, 294.44, 346.40, 407.53], exc: 3.54, adv: 1.37, gris: 0.22 },
  { nome: 'Interior 2', uf: 'TO', regiao: 'NORTE', prazo: [18,20], fp: [291.99, 343.51, 404.14, 475.45], exc: 4.13, adv: 1.59, gris: 0.22 },
  { nome: 'Interior 3', uf: 'TO', regiao: 'NORTE', prazo: [19,21], fp: [333.70, 392.59, 461.87, 543.38], exc: 4.73, adv: 1.82, gris: 0.22 },

  // NORDESTE
  { nome: 'Maceió', uf: 'AL', regiao: 'NORDESTE', prazo: [15,17], fp: [182.74, 214.99, 252.93, 297.56], exc: 2.59, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'AL', regiao: 'NORDESTE', prazo: [15,17], fp: [201.01, 236.49, 278.22, 327.32], exc: 2.85, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'AL', regiao: 'NORDESTE', prazo: [20,22], fp: [274.11, 322.48, 379.39, 446.34], exc: 3.88, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'AL', regiao: 'NORDESTE', prazo: [21,23], fp: [319.80, 376.23, 442.62, 520.73], exc: 4.53, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'AL', regiao: 'NORDESTE', prazo: [22,24], fp: [365.48, 429.98, 505.86, 595.13], exc: 5.18, adv: 1.60, gris: 0.22 },

  { nome: 'Salvador', uf: 'BA', regiao: 'NORDESTE', prazo: [13,15], fp: [182.74, 214.99, 252.93, 297.56], exc: 2.59, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'BA', regiao: 'NORDESTE', prazo: [13,15], fp: [201.01, 236.49, 278.22, 327.32], exc: 2.85, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'BA', regiao: 'NORDESTE', prazo: [20,22], fp: [274.11, 322.48, 379.39, 446.34], exc: 3.88, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'BA', regiao: 'NORDESTE', prazo: [21,23], fp: [319.80, 376.23, 442.62, 520.73], exc: 4.53, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'BA', regiao: 'NORDESTE', prazo: [22,24], fp: [365.48, 429.98, 505.86, 595.13], exc: 5.18, adv: 1.60, gris: 0.22 },

  { nome: 'Fortaleza', uf: 'CE', regiao: 'NORDESTE', prazo: [17,19], fp: [198.63, 233.68, 274.92, 323.44], exc: 2.81, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'CE', regiao: 'NORDESTE', prazo: [17,19], fp: [218.49, 257.05, 302.41, 355.78], exc: 3.09, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'CE', regiao: 'NORDESTE', prazo: [22,24], fp: [297.95, 350.53, 412.38, 485.16], exc: 4.22, adv: 1.60, gris: 0.22 },
  { nome: 'Interior 2', uf: 'CE', regiao: 'NORDESTE', prazo: [23,25], fp: [347.60, 408.95, 481.11, 566.02], exc: 4.92, adv: 1.70, gris: 0.22 },
  { nome: 'Interior 3', uf: 'CE', regiao: 'NORDESTE', prazo: [24,26], fp: [397.26, 467.37, 549.84, 646.88], exc: 5.63, adv: 1.80, gris: 0.22 },

  { nome: 'São Luís', uf: 'MA', regiao: 'NORDESTE', prazo: [16,18], fp: [186.71, 219.66, 258.43, 304.03], exc: 2.64, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'MA', regiao: 'NORDESTE', prazo: [16,18], fp: [205.38, 241.63, 284.27, 334.43], exc: 2.91, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'MA', regiao: 'NORDESTE', prazo: [21,23], fp: [280.07, 329.49, 387.64, 456.05], exc: 3.97, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'MA', regiao: 'NORDESTE', prazo: [22,24], fp: [326.75, 384.41, 452.25, 532.05], exc: 4.63, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'MA', regiao: 'NORDESTE', prazo: [23,25], fp: [373.43, 439.33, 516.85, 608.06], exc: 5.29, adv: 1.60, gris: 0.22 },

  { nome: 'João Pessoa', uf: 'PB', regiao: 'NORDESTE', prazo: [16,18], fp: [190.69, 224.34, 263.93, 310.50], exc: 2.70, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'PB', regiao: 'NORDESTE', prazo: [16,18], fp: [209.75, 246.77, 290.32, 341.55], exc: 2.97, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'PB', regiao: 'NORDESTE', prazo: [21,23], fp: [286.03, 336.50, 395.89, 465.75], exc: 4.05, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'PB', regiao: 'NORDESTE', prazo: [22,24], fp: [333.70, 392.59, 461.87, 543.38], exc: 4.73, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'PB', regiao: 'NORDESTE', prazo: [23,25], fp: [381.37, 448.67, 527.85, 621.00], exc: 5.40, adv: 1.60, gris: 0.22 },

  { nome: 'Recife', uf: 'PE', regiao: 'NORDESTE', prazo: [16,18], fp: [186.71, 219.66, 258.43, 304.03], exc: 2.64, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'PE', regiao: 'NORDESTE', prazo: [16,18], fp: [205.38, 241.63, 284.27, 334.43], exc: 2.91, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'PE', regiao: 'NORDESTE', prazo: [21,23], fp: [280.07, 329.49, 387.64, 456.05], exc: 3.97, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'PE', regiao: 'NORDESTE', prazo: [22,24], fp: [326.75, 384.41, 452.25, 532.05], exc: 4.63, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'PE', regiao: 'NORDESTE', prazo: [23,25], fp: [373.43, 439.33, 516.85, 608.06], exc: 5.29, adv: 1.60, gris: 0.22 },

  { nome: 'Teresina', uf: 'PI', regiao: 'NORDESTE', prazo: [15,17], fp: [186.71, 219.66, 258.43, 304.03], exc: 2.64, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'PI', regiao: 'NORDESTE', prazo: [15,17], fp: [205.38, 241.63, 284.27, 334.43], exc: 2.91, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'PI', regiao: 'NORDESTE', prazo: [20,22], fp: [280.07, 329.49, 387.64, 456.05], exc: 3.97, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'PI', regiao: 'NORDESTE', prazo: [21,23], fp: [326.75, 384.41, 452.25, 532.05], exc: 4.63, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'PI', regiao: 'NORDESTE', prazo: [22,24], fp: [373.43, 439.33, 516.85, 608.06], exc: 5.29, adv: 1.60, gris: 0.22 },

  { nome: 'Natal', uf: 'RN', regiao: 'NORDESTE', prazo: [17,19], fp: [194.66, 229.01, 269.42, 316.97], exc: 2.76, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'RN', regiao: 'NORDESTE', prazo: [17,19], fp: [214.12, 251.91, 296.37, 348.67], exc: 3.03, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'RN', regiao: 'NORDESTE', prazo: [22,24], fp: [291.99, 343.51, 404.14, 475.45], exc: 4.13, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'RN', regiao: 'NORDESTE', prazo: [23,25], fp: [340.65, 400.77, 471.49, 554.70], exc: 4.82, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'RN', regiao: 'NORDESTE', prazo: [24,26], fp: [389.32, 458.02, 538.85, 633.94], exc: 5.51, adv: 1.60, gris: 0.22 },

  { nome: 'Aracaju', uf: 'SE', regiao: 'NORDESTE', prazo: [14,16], fp: [178.77, 210.32, 247.43, 291.09], exc: 2.53, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'SE', regiao: 'NORDESTE', prazo: [14,16], fp: [196.64, 231.35, 272.17, 320.20], exc: 2.78, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'SE', regiao: 'NORDESTE', prazo: [19,21], fp: [268.15, 315.47, 371.14, 436.64], exc: 3.80, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'SE', regiao: 'NORDESTE', prazo: [20,22], fp: [312.84, 368.05, 433.00, 509.41], exc: 4.43, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'SE', regiao: 'NORDESTE', prazo: [21,23], fp: [357.54, 420.63, 494.86, 582.19], exc: 5.06, adv: 1.60, gris: 0.22 },

  // SUDESTE
  { nome: 'Vitória', uf: 'ES', regiao: 'SUDESTE', prazo: [11,13], fp: [174.80, 205.64, 241.93, 284.63], exc: 2.48, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'ES', regiao: 'SUDESTE', prazo: [11,13], fp: [192.27, 226.21, 266.12, 313.09], exc: 2.72, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'ES', regiao: 'SUDESTE', prazo: [15,17], fp: [262.19, 308.46, 362.90, 426.94], exc: 3.71, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'ES', regiao: 'SUDESTE', prazo: [16,18], fp: [305.89, 359.87, 423.38, 498.09], exc: 4.33, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'ES', regiao: 'SUDESTE', prazo: [17,19], fp: [349.59, 411.28, 483.86, 569.25], exc: 4.95, adv: 1.60, gris: 0.22 },

  { nome: 'Belo Horizonte', uf: 'MG', regiao: 'SUDESTE', prazo: [10,12], fp: [158.90, 186.95, 219.94, 258.75], exc: 2.25, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'MG', regiao: 'SUDESTE', prazo: [10,12], fp: [174.80, 205.64, 241.93, 284.63], exc: 2.48, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'MG', regiao: 'SUDESTE', prazo: [20,22], fp: [487.07, 497.01, 507.15, 517.50], exc: 4.50, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'MG', regiao: 'SUDESTE', prazo: [21,23], fp: [547.95, 559.13, 570.54, 582.19], exc: 5.06, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'MG', regiao: 'SUDESTE', prazo: [22,24], fp: [608.83, 621.26, 633.94, 646.88], exc: 5.63, adv: 1.60, gris: 0.22 },

  { nome: 'Rio de Janeiro', uf: 'RJ', regiao: 'SUDESTE', prazo: [9,11], fp: [154.93, 182.27, 214.44, 252.28], exc: 2.19, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'RJ', regiao: 'SUDESTE', prazo: [9,11], fp: [170.43, 200.50, 235.88, 277.51], exc: 2.41, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'RJ', regiao: 'SUDESTE', prazo: [14,16], fp: [232.40, 273.41, 321.66, 378.42], exc: 3.29, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'RJ', regiao: 'SUDESTE', prazo: [15,17], fp: [271.13, 318.98, 375.27, 441.49], exc: 3.84, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'RJ', regiao: 'SUDESTE', prazo: [16,18], fp: [309.86, 364.55, 428.88, 504.56], exc: 4.39, adv: 1.60, gris: 0.22 },

  { nome: 'São Paulo', uf: 'SP', regiao: 'SUDESTE', prazo: [6,8], fp: [146.99, 172.93, 203.44, 239.34], exc: 2.08, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'SP', regiao: 'SUDESTE', prazo: [6,8], fp: [161.69, 190.22, 223.79, 263.28], exc: 2.29, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'SP', regiao: 'SUDESTE', prazo: [11,13], fp: [220.48, 259.39, 305.16, 359.02], exc: 3.12, adv: 1.60, gris: 0.22 },
  { nome: 'Interior 2', uf: 'SP', regiao: 'SUDESTE', prazo: [12,14], fp: [257.23, 302.62, 356.02, 418.85], exc: 3.64, adv: 1.70, gris: 0.22 },
  { nome: 'Interior 3', uf: 'SP', regiao: 'SUDESTE', prazo: [13,15], fp: [293.97, 345.85, 406.88, 478.69], exc: 4.16, adv: 1.80, gris: 0.22 },

  // SUL
  { nome: 'Curitiba', uf: 'PR', regiao: 'SUL', prazo: [6,8], fp: [139.04, 163.58, 192.45, 226.41], exc: 1.97, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'PR', regiao: 'SUL', prazo: [6,8], fp: [152.95, 179.94, 211.69, 249.05], exc: 2.17, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'PR', regiao: 'SUL', prazo: [11,13], fp: [208.56, 245.37, 288.67, 339.61], exc: 2.95, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'PR', regiao: 'SUL', prazo: [12,14], fp: [243.32, 286.26, 336.78, 396.21], exc: 3.45, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'PR', regiao: 'SUL', prazo: [13,15], fp: [278.08, 327.16, 384.89, 452.81], exc: 3.94, adv: 1.60, gris: 0.22 },

  { nome: 'Porto Alegre', uf: 'RS', regiao: 'SUL', prazo: [6,8], fp: [143.01, 168.25, 197.94, 232.88], exc: 2.03, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'RS', regiao: 'SUL', prazo: [6,8], fp: [157.32, 185.08, 217.74, 256.16], exc: 2.23, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'RS', regiao: 'SUL', prazo: [11,13], fp: [214.52, 252.38, 296.92, 349.31], exc: 3.04, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'RS', regiao: 'SUL', prazo: [12,14], fp: [250.28, 294.44, 346.40, 407.53], exc: 3.54, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'RS', regiao: 'SUL', prazo: [13,15], fp: [286.03, 336.50, 395.89, 465.75], exc: 4.05, adv: 1.60, gris: 0.22 },

  // CENTRO-OESTE
  { nome: 'Brasília', uf: 'DF', regiao: 'CENTRO_OESTE', prazo: [14,16], fp: [193.67, 227.84, 268.05, 315.35], exc: 2.74, adv: 1.00, gris: 0.22 },
  { nome: 'Cidade Satélite', uf: 'DF', regiao: 'CENTRO_OESTE', prazo: [14,16], fp: [193.67, 227.84, 268.05, 315.35], exc: 2.74, adv: 1.00, gris: 0.22 },

  { nome: 'Goiânia', uf: 'GO', regiao: 'CENTRO_OESTE', prazo: [11,13], fp: [154.93, 182.27, 214.44, 252.28], exc: 2.19, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'GO', regiao: 'CENTRO_OESTE', prazo: [11,13], fp: [170.43, 200.50, 235.88, 277.51], exc: 2.41, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'GO', regiao: 'CENTRO_OESTE', prazo: [16,18], fp: [232.40, 273.41, 321.66, 378.42], exc: 3.29, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'GO', regiao: 'CENTRO_OESTE', prazo: [17,19], fp: [271.13, 318.98, 375.27, 441.49], exc: 3.84, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'GO', regiao: 'CENTRO_OESTE', prazo: [18,20], fp: [309.86, 364.55, 428.88, 504.56], exc: 4.39, adv: 1.60, gris: 0.22 },

  { nome: 'Campo Grande', uf: 'MS', regiao: 'CENTRO_OESTE', prazo: [12,14], fp: [154.93, 182.27, 214.44, 252.28], exc: 2.19, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'MS', regiao: 'CENTRO_OESTE', prazo: [12,14], fp: [170.43, 200.50, 235.88, 277.51], exc: 2.41, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'MS', regiao: 'CENTRO_OESTE', prazo: [17,19], fp: [232.40, 273.41, 321.66, 378.42], exc: 3.29, adv: 1.20, gris: 0.22 },
  { nome: 'Interior 2', uf: 'MS', regiao: 'CENTRO_OESTE', prazo: [18,20], fp: [271.13, 318.98, 375.27, 441.49], exc: 3.84, adv: 1.40, gris: 0.22 },
  { nome: 'Interior 3', uf: 'MS', regiao: 'CENTRO_OESTE', prazo: [19,21], fp: [309.86, 364.55, 428.88, 504.56], exc: 4.39, adv: 1.60, gris: 0.22 },

  { nome: 'Cuiabá', uf: 'MT', regiao: 'CENTRO_OESTE', prazo: [13,15], fp: [162.88, 191.62, 225.44, 265.22], exc: 2.31, adv: 0.80, gris: 0.22 },
  { nome: 'Interior 0', uf: 'MT', regiao: 'CENTRO_OESTE', prazo: [13,15], fp: [179.17, 210.78, 247.98, 291.74], exc: 2.54, adv: 0.88, gris: 0.22 },
  { nome: 'Interior 1', uf: 'MT', regiao: 'CENTRO_OESTE', prazo: [18,20], fp: [244.32, 287.43, 338.15, 397.83], exc: 3.46, adv: 1.60, gris: 0.22 },
  { nome: 'Interior 2', uf: 'MT', regiao: 'CENTRO_OESTE', prazo: [19,21], fp: [285.04, 335.34, 394.51, 464.13], exc: 4.04, adv: 1.70, gris: 0.22 },
  { nome: 'Interior 3', uf: 'MT', regiao: 'CENTRO_OESTE', prazo: [20,22], fp: [325.75, 383.24, 450.87, 530.44], exc: 4.61, adv: 1.80, gris: 0.22 },
];

// Faixas de peso padrão: [0-30kg, 30-50kg, 50-70kg, 70-100kg] em gramas
const FAIXAS_KG = [
  { min: 0, max: 30000 },
  { min: 30001, max: 50000 },
  { min: 50001, max: 70000 },
  { min: 70001, max: 100000 },
];

async function main() {
  // ── Planos ──
  const starter = await prisma.plano.upsert({
    where: { id: 'plano-starter' },
    update: {},
    create: { id: 'plano-starter', nome: 'Starter', limite_mensal: 500, preco_centavos: 150000 },
  });
  const growth = await prisma.plano.upsert({
    where: { id: 'plano-growth' },
    update: {},
    create: { id: 'plano-growth', nome: 'Growth', limite_mensal: 2000, preco_centavos: 350000 },
  });
  await prisma.plano.upsert({
    where: { id: 'plano-enterprise' },
    update: {},
    create: { id: 'plano-enterprise', nome: 'Enterprise', limite_mensal: 10000, preco_centavos: 800000 },
  });
  await prisma.plano.upsert({
    where: { id: 'plano-custom' },
    update: {},
    create: { id: 'plano-custom', nome: 'Custom', limite_mensal: 999999, preco_centavos: 0 },
  });
  console.log('✅ Planos criados');

  // ── Admin SaaS ──
  const senhaAdmin = await bcrypt.hash('admin123', 10);
  await prisma.usuario.upsert({
    where: { email: 'admin@fretematch.com.br' },
    update: {},
    create: { nome: 'Admin FreteMatch', email: 'admin@fretematch.com.br', senha_hash: senhaAdmin, perfil: 'ADMIN_SAAS' },
  });
  console.log('✅ Admin criado — admin@fretematch.com.br / admin123');

  // ── Tenant de teste (Smartech) ──
  const tenantSmarttech = await prisma.tenant.upsert({
    where: { slug: 'smartech' },
    update: {},
    create: {
      nome: 'Smartech Indústria e Comércio',
      cnpj: '08.700.337/0001-13',
      email: 'contato@smartech.com.br',
      telefone_responsavel: '5547997161999',
      slug: 'smartech',
      plano_id: growth.id,
    },
  });

  const senhaTenant = await bcrypt.hash('smartech123', 10);
  await prisma.usuario.upsert({
    where: { email: 'admin@smartech.com.br' },
    update: {},
    create: {
      nome: 'Admin Smartech',
      email: 'admin@smartech.com.br',
      senha_hash: senhaTenant,
      perfil: 'ADMIN_TENANT',
      tenant_id: tenantSmarttech.id,
    },
  });
  console.log('✅ Tenant Smartech criado — admin@smartech.com.br / smartech123');

  // ── Tenant Rodolog ──
  const tenantRodolog = await prisma.tenant.upsert({
    where: { slug: 'rodolog' },
    update: {},
    create: {
      nome: 'Rodolog Transportes',
      cnpj: '00.000.000/0001-00',
      slug: 'rodolog',
      email: 'admin@rodolog.com.br',
      telefone_responsavel: '',
      plano_id: growth.id,
    },
  });

  const senhaRodolog = await bcrypt.hash('rodolog123', 10);
  await prisma.usuario.upsert({
    where: { email: 'admin@rodolog.com.br' },
    update: {},
    create: {
      nome: 'Admin Rodolog',
      email: 'admin@rodolog.com.br',
      senha_hash: senhaRodolog,
      perfil: 'ADMIN_TENANT',
      tenant_id: tenantRodolog.id,
    },
  });
  console.log('✅ Tenant Rodolog criado — admin@rodolog.com.br / rodolog123');

  // ── Tabela TodoBrasil ──
  // Deleta tabela existente para recriar (seed idempotente via slug)
  const tabelaExistente = await prisma.tabelaFrete.findFirst({
    where: { tenant_id: tenantSmarttech.id, nome: 'TodoBrasil — São Bento do Sul/SC' },
  });
  if (tabelaExistente) {
    // Deleta faixas e regiões antes de deletar a tabela
    const regioes = await prisma.regiaoFrete.findMany({ where: { tabela_id: tabelaExistente.id } });
    for (const reg of regioes) {
      await prisma.faixaPrecoRegiao.deleteMany({ where: { regiao_id: reg.id } });
    }
    await prisma.regiaoFrete.deleteMany({ where: { tabela_id: tabelaExistente.id } });
    await prisma.tabelaFrete.delete({ where: { id: tabelaExistente.id } });
  }

  const tabela = await prisma.tabelaFrete.create({
    data: {
      nome: 'TodoBrasil — São Bento do Sul/SC',
      origem_descricao: 'São Bento do Sul/SC (Interior 1)',
      transportadora: 'TodoBrasil',
      ativa: true,
      taxa_despacho_centavos: r(30.00),
      pedagio_por_100kg_centavos: r(7.00),
      gris_percentual_padrao: 0.22,
      gris_minimo_centavos: r(2.50),
      tenant_id: tenantSmarttech.id,
    },
  });

  // Cria regiões e faixas
  let totalRegioes = 0;
  for (const reg of REGIOES_TODOBRASIL) {
    const regiao = await prisma.regiaoFrete.create({
      data: {
        nome: reg.nome,
        uf: reg.uf,
        regiao_brasil: reg.regiao,
        prazo_min_dias: reg.prazo[0],
        prazo_max_dias: reg.prazo[1],
        ad_valorem_percentual: reg.adv,
        ad_valorem_minimo_centavos: r(5.66),
        gris_percentual: reg.gris,
        gris_minimo_centavos: r(2.50),
        preco_kg_excedente_centavos: r(reg.exc),
        tabela_id: tabela.id,
        faixas_peso: {
          create: FAIXAS_KG.map((faixa, i) => ({
            peso_min_g: faixa.min,
            peso_max_g: faixa.max,
            preco_centavos: r(reg.fp[i]),
          })),
        },
      },
    });
    totalRegioes++;
  }

  console.log(`✅ Tabela TodoBrasil criada com ${totalRegioes} regiões`);
  console.log('\n🚀 Seed concluído!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
