import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string' ? exceptionResponse : (exceptionResponse as any).message || message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle Prisma errors gracefully to not leak database details
      status = HttpStatus.BAD_REQUEST;
      if (exception.code === 'P2002') {
        message = 'A record with that unique field already exists.';
      } else {
        message = 'Database operation failed.';
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided for database operation.';
    } else {
      this.logger.error(`[Unhandled Exception] ${request.method} ${request.url}`, (exception as any)?.stack);
    }

    // Only log the full error stack trace on the server side
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
       this.logger.error(`Error processing request: ${request.method} ${request.url}`, exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
