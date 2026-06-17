import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { tenant: true },
  });

  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaCorreta) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      tenant_id: usuario.tenant_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      tenant: usuario.tenant ? { id: usuario.tenant.id, nome: usuario.tenant.nome } : null,
    },
  });
});

// POST /auth/trocar-senha
router.post('/trocar-senha', async (req, res) => {
  const { email, senha_atual, nova_senha } = req.body;

  if (!email || !senha_atual || !nova_senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado' });
  }

  const senhaCorreta = await bcrypt.compare(senha_atual, usuario.senha_hash);
  if (!senhaCorreta) {
    return res.status(401).json({ erro: 'Senha atual incorreta' });
  }

  const nova_hash = await bcrypt.hash(nova_senha, 10);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senha_hash: nova_hash },
  });

  res.json({ mensagem: 'Senha atualizada com sucesso' });
});

export const rotasAuth = router;
