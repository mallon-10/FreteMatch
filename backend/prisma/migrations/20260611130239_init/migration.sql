-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN_SAAS', 'ADMIN_TENANT', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoFator" AS ENUM ('ESTADO', 'REGIAO', 'CEP_PREFIXO');

-- CreateEnum
CREATE TYPE "TipoCarga" AS ENUM ('DOCUMENTO', 'ENCOMENDA', 'FRACIONADA', 'LOTACAO');

-- CreateEnum
CREATE TYPE "StatusCotacao" AS ENUM ('PENDENTE', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA');

-- CreateTable
CREATE TABLE "Plano" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "limite_mensal" INTEGER NOT NULL,
    "preco_centavos" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plano_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone_responsavel" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plano_id" TEXT NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'OPERADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteTenant" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "nome" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "ClienteTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TabelaFrete" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "TabelaFrete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaixaPeso" (
    "id" TEXT NOT NULL,
    "peso_min_g" INTEGER NOT NULL,
    "peso_max_g" INTEGER NOT NULL,
    "preco_centavos" INTEGER NOT NULL,
    "tabela_id" TEXT NOT NULL,

    CONSTRAINT "FaixaPeso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FatorDistancia" (
    "id" TEXT NOT NULL,
    "tipo" "TipoFator" NOT NULL,
    "valor" TEXT NOT NULL,
    "fator" DOUBLE PRECISION NOT NULL,
    "prazo_dias" INTEGER NOT NULL,
    "tabela_id" TEXT NOT NULL,

    CONSTRAINT "FatorDistancia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrazoEntrega" (
    "id" TEXT NOT NULL,
    "tipo_carga" "TipoCarga" NOT NULL,
    "prazo_dias" INTEGER NOT NULL,
    "tabela_id" TEXT NOT NULL,

    CONSTRAINT "PrazoEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotacao" (
    "id" TEXT NOT NULL,
    "cep_origem" TEXT NOT NULL,
    "cep_destino" TEXT NOT NULL,
    "cidade_origem" TEXT,
    "cidade_destino" TEXT,
    "estado_origem" TEXT,
    "estado_destino" TEXT,
    "tipo_carga" "TipoCarga" NOT NULL,
    "peso_g" INTEGER NOT NULL,
    "altura_cm" INTEGER,
    "largura_cm" INTEGER,
    "comprimento_cm" INTEGER,
    "valor_centavos" INTEGER NOT NULL,
    "prazo_dias" INTEGER NOT NULL,
    "status" "StatusCotacao" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cliente_id" TEXT,

    CONSTRAINT "Cotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsoMensal" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "total_cotacoes" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "UsoMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanciaZapi" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "client_token" TEXT NOT NULL,
    "conectada" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "InstanciaZapi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_cnpj_key" ON "Tenant"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteTenant_tenant_id_telefone_key" ON "ClienteTenant"("tenant_id", "telefone");

-- CreateIndex
CREATE UNIQUE INDEX "UsoMensal_tenant_id_ano_mes_key" ON "UsoMensal"("tenant_id", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "InstanciaZapi_tenant_id_key" ON "InstanciaZapi"("tenant_id");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_plano_id_fkey" FOREIGN KEY ("plano_id") REFERENCES "Plano"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClienteTenant" ADD CONSTRAINT "ClienteTenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TabelaFrete" ADD CONSTRAINT "TabelaFrete_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaixaPeso" ADD CONSTRAINT "FaixaPeso_tabela_id_fkey" FOREIGN KEY ("tabela_id") REFERENCES "TabelaFrete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FatorDistancia" ADD CONSTRAINT "FatorDistancia_tabela_id_fkey" FOREIGN KEY ("tabela_id") REFERENCES "TabelaFrete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrazoEntrega" ADD CONSTRAINT "PrazoEntrega_tabela_id_fkey" FOREIGN KEY ("tabela_id") REFERENCES "TabelaFrete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotacao" ADD CONSTRAINT "Cotacao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotacao" ADD CONSTRAINT "Cotacao_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "ClienteTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsoMensal" ADD CONSTRAINT "UsoMensal_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanciaZapi" ADD CONSTRAINT "InstanciaZapi_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
