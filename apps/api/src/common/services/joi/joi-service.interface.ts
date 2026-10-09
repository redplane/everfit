import Joi from 'joi';

export interface IJoiService {
  //#region Methods
  validateAsync<T>(instance: T, schema: Joi.Schema<T>): Promise<T>;
  //#endregion
}
