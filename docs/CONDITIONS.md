# S.A.M Conditions Reference

Conditions allow you to filter when listeners fire based on value criteria. Instead of filtering in your callback, conditions are evaluated at the native level for better performance.

## Table of Contents

- [Condition Types](#condition-types)
- [Condition Structure](#condition-structure)
- [Usage Examples](#usage-examples)
- [Combining Conditions](#combining-conditions)
- [Row Conditions (Cold Storage)](#row-conditions-cold-storage)

---

## Condition Types

### Existence Conditions

| Type | Description | Fires When |
|------|-------------|------------|
| `exists` | Value exists | Key has any non-null value |
| `notExists` | Value doesn't exist | Key is null/undefined/deleted |

### Equality Conditions

| Type | Description | Fires When |
|------|-------------|------------|
| `equals` | Value equals | `value === condition.value` |
| `notEquals` | Value doesn't equal | `value !== condition.value` |

### String Conditions

| Type | Description | Fires When |
|------|-------------|------------|
| `contains` | Contains substring | `value.includes(condition.value)` |
| `startsWith` | Starts with string | `value.startsWith(condition.value)` |
| `endsWith` | Ends with string | `value.endsWith(condition.value)` |
| `matchesRegex` | Matches regex | `new RegExp(condition.regex).test(value)` |

### Numeric Conditions

| Type | Description | Fires When |
|------|-------------|------------|
| `greaterThan` | Greater than | `value > condition.value` |
| `lessThan` | Less than | `value < condition.value` |
| `greaterThanOrEqual` | Greater than or equal | `value >= condition.value` |
| `lessThanOrEqual` | Less than or equal | `value <= condition.value` |

### Array Conditions

| Type | Description | Fires When |
|------|-------------|------------|
| `in` | Value in array | `condition.values.includes(value)` |
| `notIn` | Value not in array | `!condition.values.includes(value)` |

### Change Condition

| Type | Description | Fires When |
|------|-------------|------------|
| `changed` | Value changed | `oldValue !== newValue` |

---

## Condition Structure

```typescript
interface Condition {
  type: ConditionType;
  value?: string | number | boolean;  // For single-value conditions
  values?: Array<string | number>;     // For array conditions (in, notIn)
  regex?: string;                      // For matchesRegex
}
```

---

## Usage Examples

### Existence Conditions

```typescript
// Fire only when key exists
useWarm({
  keys: ['user.profile'],
  conditions: [{ type: 'exists' }]
});

// Fire only when key is deleted/null
useWarm({
  keys: ['auth.token'],
  conditions: [{ type: 'notExists' }]
}, () => {
  // Token was deleted, redirect to login
  navigation.navigate('Login');
});
```

### Equality Conditions

```typescript
// Fire when status equals 'complete'
useWarm({
  keys: ['order.status'],
  conditions: [{ type: 'equals', value: 'complete' }]
}, () => {
  showCompletionMessage();
});

// Fire when status is NOT 'draft'
useWarm({
  keys: ['document.status'],
  conditions: [{ type: 'notEquals', value: 'draft' }]
});

// Works with numbers
useWarm({
  keys: ['cart.itemCount'],
  conditions: [{ type: 'equals', value: 0 }]
}, () => {
  showEmptyCartMessage();
});

// Works with booleans
useWarm({
  keys: ['user.verified'],
  conditions: [{ type: 'equals', value: true }]
});
```

### String Conditions

```typescript
// Fire when value contains substring
useWarm({
  keys: ['search.results'],
  conditions: [{ type: 'contains', value: 'error' }]
}, () => {
  showErrorMessage();
});

// Fire when value starts with prefix
useWarm({
  keys: ['api.endpoint'],
  conditions: [{ type: 'startsWith', value: 'https://' }]
});

// Fire when value ends with suffix
useWarm({
  keys: ['file.name'],
  conditions: [{ type: 'endsWith', value: '.pdf' }]
});

// Fire when value matches regex
useWarm({
  keys: ['user.email'],
  conditions: [{
    type: 'matchesRegex',
    regex: '^[a-z]+@company\\.com$'
  }]
});
```

### Numeric Conditions

```typescript
// Fire when cart total exceeds $100
useWarm({
  keys: ['cart.total'],
  conditions: [{ type: 'greaterThan', value: 100 }]
}, () => {
  showFreeShippingBanner();
});

// Fire when inventory is low (< 10)
useWarm({
  keys: ['product.stock'],
  conditions: [{ type: 'lessThan', value: 10 }]
}, () => {
  showLowStockWarning();
});

// Fire when score reaches threshold
useWarm({
  keys: ['game.score'],
  conditions: [{ type: 'greaterThanOrEqual', value: 1000 }]
}, () => {
  unlockAchievement('high-scorer');
});

// Fire when temperature drops below freezing
useWarm({
  keys: ['weather.temp'],
  conditions: [{ type: 'lessThanOrEqual', value: 32 }]
}, () => {
  showFrostWarning();
});
```

### Array Conditions

```typescript
// Fire when status is one of several values
useWarm({
  keys: ['order.status'],
  conditions: [{
    type: 'in',
    values: ['shipped', 'delivered', 'complete']
  }]
}, () => {
  showTrackingInfo();
});

// Fire when role is NOT admin or moderator
useWarm({
  keys: ['user.role'],
  conditions: [{
    type: 'notIn',
    values: ['admin', 'moderator']
  }]
}, () => {
  // Regular user actions
});
```

### Change Condition

```typescript
// Fire on any change (this is default behavior, but explicit)
useWarm({
  keys: ['data.value'],
  conditions: [{ type: 'changed' }]
});
```

---

## Combining Conditions

When multiple conditions are provided, they are combined with AND logic by default.

### Multiple Conditions (AND)

```typescript
// Fire when total > 100 AND total < 1000
useWarm({
  keys: ['cart.total'],
  conditions: [
    { type: 'greaterThan', value: 100 },
    { type: 'lessThan', value: 1000 }
  ]
});

// Fire when status exists AND equals 'active'
useWarm({
  keys: ['subscription.status'],
  conditions: [
    { type: 'exists' },
    { type: 'equals', value: 'active' }
  ]
});
```

### Practical Examples

```typescript
// Notify when high-value order is placed
// total > 500 AND status = 'confirmed'
useWarm({
  keys: ['order.total', 'order.status'],
  conditions: [
    { type: 'greaterThan', value: 500 },
    { type: 'equals', value: 'confirmed' }
  ]
}, () => {
  alertSalesTeam();
});

// Alert when user becomes premium with valid email
useWarm({
  keys: ['user.tier', 'user.email'],
  conditions: [
    { type: 'equals', value: 'premium' },
    { type: 'matchesRegex', regex: '^.+@.+\\..+$' }
  ]
});
```

---

## Row Conditions (Cold Storage)

For Cold storage listeners, use `RowCondition` to filter based on row data.

### Structure

```typescript
interface RowCondition {
  column: string;
  condition: Condition;
}
```

### Examples

```typescript
// Watch orders with high value
useCold({
  table: 'orders',
  operations: ['INSERT', 'UPDATE'],
  where: [
    {
      column: 'total',
      condition: { type: 'greaterThan', value: 1000 }
    }
  ]
});

// Watch urgent tasks only
useCold({
  table: 'tasks',
  operations: ['INSERT'],
  where: [
    {
      column: 'priority',
      condition: { type: 'equals', value: 'urgent' }
    },
    {
      column: 'status',
      condition: { type: 'notEquals', value: 'complete' }
    }
  ]
});

// Watch specific user's orders
useCold({
  table: 'orders',
  where: [
    {
      column: 'user_id',
      condition: { type: 'equals', value: currentUserId }
    }
  ]
});

// Watch orders with specific statuses
useCold({
  table: 'orders',
  where: [
    {
      column: 'status',
      condition: {
        type: 'in',
        values: ['pending', 'processing', 'shipped']
      }
    }
  ]
});
```

---

## Performance Notes

1. **Conditions are evaluated natively** - No JS overhead for filtering
2. **Use conditions instead of callback filtering** - Better performance
3. **Specific conditions are faster** - `equals` is faster than `matchesRegex`
4. **Combine conditions carefully** - Each condition adds evaluation cost

```typescript
// Good - native filtering
useWarm({
  keys: ['value'],
  conditions: [{ type: 'greaterThan', value: 100 }]
});

// Avoid - JS filtering
useWarm({ keys: ['value'] }, (event) => {
  if (event.newValue > 100) { /* ... */ }
});
```
