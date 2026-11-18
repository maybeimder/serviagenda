import { Router } from "express";
import { UsersController } from "../controllers/users.controller";
import { validate } from "../middlewares/validate";
import { idParams } from "../schemas/common";
import { updatePatientBody, updateTherapistBody } from "../schemas/users.schema";

/** /api/users: pacientes y terapeutas. */
export const usersRouter = Router();

usersRouter.get("/patients", UsersController.listPatients);
usersRouter.get("/patients/:id", validate({ params: idParams }), UsersController.getPatient);
usersRouter.put("/patients/:id", validate({ params: idParams, body: updatePatientBody }), UsersController.updatePatient);

usersRouter.get("/therapists", UsersController.listTherapists);
usersRouter.get("/therapists/:id", validate({ params: idParams }), UsersController.getTherapist);
usersRouter.put("/therapists/:id", validate({ params: idParams, body: updateTherapistBody }), UsersController.updateTherapist);
