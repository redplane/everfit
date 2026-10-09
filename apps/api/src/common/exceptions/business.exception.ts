import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  //#region Constructor
  public constructor(
    public readonly code: string,
    public override readonly message: string,
    status: HttpStatus | number = HttpStatus.BAD_REQUEST,
  ) {
    super(message, status);
  }
  //#endregion
}
