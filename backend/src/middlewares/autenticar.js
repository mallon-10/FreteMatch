import jwt from 'jsonwebtoken';

export function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não informado' });
  }

  const token = cabecalho.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

export function apenasAdmin(req, res, next) {
  if (req.usuario?.perfil !== 'ADMIN_SAAS') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores' });
  }
  next();
}
