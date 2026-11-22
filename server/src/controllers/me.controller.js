export function createMeController(service) {
  return {
    anonymize: async (req, res, next) => {
      try {
        // A identidade vem exclusivamente do JWT validado pelo apiAuth.
        const result = await service.anonymizeAccount(req.user.id);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  };
}
