/**
 * Base interface for all use cases
 * @template TRequest - The request/input type
 * @template TResponse - The response/output type
 */
export interface IUseCase<TRequest, TResponse> {
    /**
     * Execute the use case
     * @param request - The use case request
     * @returns Promise resolving to the use case response
     */
    execute(request: TRequest): Promise<TResponse>;
}
