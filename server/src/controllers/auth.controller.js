export function createAuthController(service) {
  return {
    bootstrapStatus: async (req, res, next) => {
      try { res.json(await service.bootstrapStatus()); } catch (error) { next(error); }
    },
    bootstrapAdministrator: async (req, res, next) => {
      try { res.status(201).json(await service.bootstrapAdministrator(req.body)); } catch (error) { next(error); }
    },
    register: async (req, res, next) => {
      try { res.status(201).json(await service.register(req.body)); } catch (error) { next(error); }
    },
    login: async (req, res, next) => {
      try { res.json(await service.login(req.body)); } catch (error) { next(error); }
    },
    refresh: async (req, res, next) => {
      try { res.json(await service.refresh(req.body)); } catch (error) { next(error); }
    },
    logout: async (req, res, next) => {
      try {
        await service.logout(req.user.id, req.body);
        res.status(204).end();
      } catch (error) { next(error); }
    },
  };
}
