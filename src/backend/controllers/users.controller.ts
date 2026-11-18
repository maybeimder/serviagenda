import type { Request, Response } from "express";
import { valid } from "../middlewares/validate";
import { idParams } from "../schemas/common";
import { updatePatientBody, updateTherapistBody } from "../schemas/users.schema";
import { UsersService } from "../services/users.service";

/** Solo HTTP: leer lo ya validado, llamar al service y responder. */
export const UsersController = {
      async listPatients(_req: Request, res: Response) {
            res.json(await UsersService.listPatients());
      },

      async getPatient(_req: Request, res: Response) {
            const { id } = valid(res, "params", idParams);
            res.json(await UsersService.getPatient(id));
      },

      async updatePatient(_req: Request, res: Response) {
            const { id } = valid(res, "params", idParams);
            res.json(await UsersService.updatePatient(id, valid(res, "body", updatePatientBody)));
      },

      async listTherapists(_req: Request, res: Response) {
            res.json(await UsersService.listTherapists());
      },

      async getTherapist(_req: Request, res: Response) {
            const { id } = valid(res, "params", idParams);
            res.json(await UsersService.getTherapist(id));
      },

      async updateTherapist(_req: Request, res: Response) {
            const { id } = valid(res, "params", idParams);
            res.json(await UsersService.updateTherapist(id, valid(res, "body", updateTherapistBody)));
      },
};
