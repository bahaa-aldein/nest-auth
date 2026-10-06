import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GlobalExceptionFilter } from './global-exception.filter.js';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let response: Pick<Response, 'status' | 'json'>;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const request = {
      method: 'GET',
      originalUrl: '/test',
    } as Request;
    host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves an HttpException status and response body', () => {
    const body = { statusCode: 404, message: 'Not found', error: 'Not Found' };
    const log = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    filter.catch(new HttpException(body, HttpStatus.NOT_FOUND), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(body);
    expect(log).toHaveBeenCalledWith('GET /test 404 - Not found');
  });

  it('returns a generic response and logs details for unexpected errors', () => {
    const error = new Error('database connection failed');
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
    expect(log).toHaveBeenCalledWith(
      'GET /test 500 - database connection failed',
      error.stack,
    );
  });
});
