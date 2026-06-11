/*
  Warnings:

  - You are about to drop the column `tipo_carga` on the `Cotacao` table. All the data in the column will be lost.
  - You are about to drop the column `valor_centavos` on the `Cotacao` table. All the data in the column will be lost.
  - You are about to drop the `FaixaPeso` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FatorDistancia` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PrazoEntrega` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `valor_total_centavos` to the `Cotacao` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "FaixaPeso" DROP CONSTRAINT "FaixaPeso_tabela_id_fkey";

-- DropForeignKey
ALTER TABLE "FatorDistancia" DROP CONSTRAINT "FatorDistancia_tabela_id_fkey";

-- DropForeignKey
ALTER TABLE "PrazoEntrega" DROP CONSTRAINT "PrazoEntrega_tabela_id_fkey";

-- AlterTable
ALTER TABLE "Cotacao" DROP COLUMN "tipo_carga",
DROP COLUMN "valor_centavos",
ADD COLUMN     "ad_valorem_centavos" INTEGER,
ADD COLUMN     "frete_peso_centavos" INTEGER,
ADD COLUMN     "gris_centavos" INTEGER,
ADD COLUMN     "pedagio_centavos" INTEGER,
ADD COLUMN     "regiao_id" TEXT,
ADD COLUMN     "taxa_despacho_centavos" INTEGER,
ADD COLUMN     "valor_nf_centavos" INTEGER,
ADD COLUMN     "valor_total_centavos" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "TabelaFrete" ADD COLUMN     "gris_minimo_centavos" INTEGER,
ADD COLUMN     "gris_percentual_padrao" DOUBLE PRECISION,
ADD COLUMN     "origem_descricao" TEXT,
ADD COLUMN     "pedagio_por_100kg_centavos" INTEGER,
ADD COLUMN     "taxa_despacho_centavos" INTEGER,
ADD COLUMN     "transportadora" TEXT;

-- DropTable
DROP TABLE "FaixaPeso";

-- DropTable
DROP TABLE "FatorDistancia";

-- DropTable
DROP TABLE "PrazoEntrega";

-- DropEnum
DROP TYPE "TipoCarga";

-- DropEnum
DROP TYPE "TipoFator";

-- CreateTable
CREATE TABLE "RegiaoFrete" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "regiao_brasil" TEXT,
    "prazo_min_dias" INTEGER NOT NULL,
    "prazo_max_dias" INTEGER NOT NULL,
    "ad_valorem_percentual" DOUBLE PRECISION NOT NULL,
    "ad_valorem_minimo_centavos" INTEGER,
    "gris_percentual" DOUBLE PRECISION,
    "gris_minimo_centavos" INTEGER,
    "preco_kg_excedente_centavos" INTEGER,
    "tabela_id" TEXT NOT NULL,

    CONSTRAINT "RegiaoFrete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaixaPrecoRegiao" (
    "id" TEXT NOT NULL,
    "peso_min_g" INTEGER NOT NULL,
    "peso_max_g" INTEGER NOT NULL,
    "preco_centavos" INTEGER NOT NULL,
    "regiao_id" TEXT NOT NULL,

    CONSTRAINT "FaixaPrecoRegiao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RegiaoFrete" ADD CONSTRAINT "RegiaoFrete_tabela_id_fkey" FOREIGN KEY ("tabela_id") REFERENCES "TabelaFrete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaixaPrecoRegiao" ADD CONSTRAINT "FaixaPrecoRegiao_regiao_id_fkey" FOREIGN KEY ("regiao_id") REFERENCES "RegiaoFrete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
