# I. Overview

This rule is about how code reads the **current time** in OOP frameworks that support
**dependency injection** — Java Spring Boot, the .NET Framework with a DI container, and
.NET Core / .NET 5+.

**DO NOT** read the current time from a static time class directly (for example
`DateTime.UtcNow` / `DateTime.Now` in .NET, `LocalDateTime.now()` / `Instant.now()` /
`System.currentTimeMillis()` in Java). Static time calls are hidden, non-injected dependencies:
they make the result depend on the wall clock, so the behavior cannot be controlled or reproduced
in a test.

Instead, obtain the time from an **injected time context** abstraction. Because it is injected,
tests can substitute a fake that returns a fixed, deterministic time — which is friendly for unit
testing.

# II. Convention

## 1. Declare the abstraction

- Declare an interface `ITimeContext` and a concrete class `TimeContext` that implements it.
- It exposes a method `GetUtcNowAsync(...)` that returns the current **UTC** time. In C# the
  method takes an **optional** `CancellationToken` parameter (idiomatic async signature).

## 2. Inject and use it

- **DO NOT** call the static time class anywhere in business logic.
- Depend on `ITimeContext` through the constructor and call `GetUtcNowAsync(...)` to read the
  current time.

### C# (.NET Framework with DI / .NET Core)

```csharp
public interface ITimeContext
{
    Task<DateTime> GetUtcNowAsync(CancellationToken cancellationToken = default);
}

public sealed class TimeContext : ITimeContext
{
    public Task<DateTime> GetUtcNowAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(DateTime.UtcNow);
}
```

```csharp
// Registration (e.g. in Startup / Program)
services.AddSingleton<ITimeContext, TimeContext>();

// Usage — inject the abstraction, never call DateTime.UtcNow directly
public sealed class InvoiceService
{
    private readonly ITimeContext _timeContext;

    public InvoiceService(ITimeContext timeContext) => _timeContext = timeContext;

    public async Task<Invoice> CreateAsync(CancellationToken cancellationToken = default)
    {
        var now = await _timeContext.GetUtcNowAsync(cancellationToken);
        return new Invoice { CreatedAtUtc = now };
    }
}
```

### Java (Spring Boot)

```java
public interface ITimeContext {
    // CancellationToken is C#-only; Java needs no equivalent parameter.
    CompletableFuture<Instant> getUtcNowAsync();
}

@Component
public class TimeContext implements ITimeContext {
    @Override
    public CompletableFuture<Instant> getUtcNowAsync() {
        return CompletableFuture.completedFuture(Instant.now());
    }
}
```

## 3. Why this helps unit testing

- In tests, inject a fake `ITimeContext` that returns a fixed instant, so time-dependent logic
  (expiry, scheduling, "created at", windows) becomes **deterministic and reproducible** — no
  flakiness from the real clock.

```csharp
// Test double
var timeContext = new FakeTimeContext(fixedUtc: new DateTime(2026, 01, 01, 0, 0, 0, DateTimeKind.Utc));
var service = new InvoiceService(timeContext);
```

## 4. Note for this NestJS project

- This repository is NestJS / TypeScript; the same rule applies with an injected
  `DateTimeContext` / `getUtcNowAsync()` instead of `new Date()` / `Date.now()` — see
  `../typescript/frameworks/nestjs/api.md` §3.5 and `../typescript/generic.md`.
