import { AppError } from '../errors/AppError.js';

// Descobre qual professor está fazendo a requisição e guarda em req.professorId,
// para os services filtrarem tudo pelo dono (RNF04: cada professor só vê o que é dele).
//
// Enquanto o login com JWT (T07) não existe, o front envia o id do professor em
// "professor_id" (query ou corpo), o mesmo combinado usado nas rotas de turmas.
// Quando a autenticação entrar, basta o middleware dela preencher req.user: ele
// passa a ter prioridade e as rotas que usam este middleware não mudam.
export function professorContext(req, res, next) {
  const raw = req.user?.id ?? req.query.professor_id ?? req.body?.professor_id;
  const professorId = Number(raw);
  if (raw === undefined || raw === '' || !Number.isInteger(professorId) || professorId <= 0) {
    throw AppError.unauthorized('Professor não identificado.');
  }
  req.professorId = professorId;
  next();
}
