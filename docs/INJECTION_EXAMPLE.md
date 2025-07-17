# OrchFlow Injection Example

This demonstrates how OrchFlow works by injecting orchestration capabilities directly into Claude's conversation.

## How It Works

1. **User launches OrchFlow**:
   ```bash
   orchflow
   ```

2. **OrchFlow starts**:
   - Launches orchestration core (API server)
   - Configures MCP tools for Claude
   - Adds system prompt teaching Claude about orchestration
   - Launches claude-flow with these injections

3. **User has a normal Claude conversation** where orchestration happens naturally:

## Example Conversation

```
User: I need to build a complete e-commerce platform. We'll need a product catalog, 
      shopping cart, payment processing, and admin dashboard.

Claude: I'll help you build a complete e-commerce platform. This is a great case for 
        parallel development since these components can be built simultaneously. Let me 
        set up dedicated workers for each major component.

        [Claude internally uses orchflow_spawn_worker for each component]
        
        I've organized our work into four parallel streams:
        
        📦 Product Catalog Developer - Building product management and browsing
        🛒 Shopping Cart Engineer - Implementing cart and checkout flow  
        💳 Payment Integration Specialist - Setting up payment processing
        👨‍💼 Admin Dashboard Builder - Creating the management interface
        
        Let's start with the overall architecture that all components will share:

        ```typescript
        // Shared interfaces that all workers will use
        interface Product {
          id: string;
          name: string;
          price: number;
          inventory: number;
          category: string;
          images: string[];
        }

        interface CartItem {
          productId: string;
          quantity: number;
          price: number;
        }

        interface Order {
          id: string;
          userId: string;
          items: CartItem[];
          total: number;
          status: 'pending' | 'processing' | 'completed' | 'cancelled';
          paymentId?: string;
        }
        ```

        [Claude uses orchflow_share_knowledge to share these interfaces with all workers]

        I'll start with the product catalog. We'll use Node.js with Express and PostgreSQL...

        [Continues building the product catalog naturally]

User: How's the payment integration coming along?

Claude: [Claude uses orchflow_switch_context to payment worker]
        
        The payment integration is progressing well! I've been working on integrating 
        Stripe for payment processing. Here's what's implemented so far:

        ```javascript
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

        class PaymentService {
          async createPaymentIntent(order) {
            try {
              const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(order.total * 100), // Stripe uses cents
                currency: 'usd',
                metadata: {
                  orderId: order.id,
                  userId: order.userId
                }
              });
              
              return {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
              };
            } catch (error) {
              throw new PaymentError('Failed to create payment intent', error);
            }
          }

          async handleWebhook(event) {
            switch (event.type) {
              case 'payment_intent.succeeded':
                await this.handlePaymentSuccess(event.data.object);
                break;
              case 'payment_intent.payment_failed':
                await this.handlePaymentFailure(event.data.object);
                break;
            }
          }
        }
        ```

        I've also set up webhook handling for payment confirmations. The payment 
        service integrates with the order system that the Shopping Cart Engineer 
        has been building.

User: Can you make sure all the components are using consistent error handling?

Claude: Good point! Let me ensure consistency across all workers. I'll create a 
        shared error handling pattern and propagate it to all components.

        [Claude uses orchflow_share_knowledge to share error handling pattern]

        I've synchronized an error handling pattern across all workers:

        ```typescript
        // Shared error classes now available to all workers
        class AppError extends Error {
          constructor(message: string, public statusCode: number, public code: string) {
            super(message);
            this.name = 'AppError';
          }
        }

        class ValidationError extends AppError {
          constructor(message: string, public fields: Record<string, string>) {
            super(message, 400, 'VALIDATION_ERROR');
          }
        }

        class PaymentError extends AppError {
          constructor(message: string, public details?: any) {
            super(message, 402, 'PAYMENT_ERROR');
          }
        }

        // Shared error handling middleware
        const errorHandler = (err, req, res, next) => {
          if (err instanceof AppError) {
            return res.status(err.statusCode).json({
              error: {
                code: err.code,
                message: err.message,
                ...(err instanceof ValidationError && { fields: err.fields })
              }
            });
          }
          
          // Log unexpected errors
          console.error('Unexpected error:', err);
          res.status(500).json({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'An unexpected error occurred'
            }
          });
        };
        ```

        All four workers are now using this consistent error handling approach. The 
        Product Catalog, Shopping Cart, Payment, and Admin Dashboard will all return 
        errors in the same format.

User: Show me the overall progress

Claude: [Claude uses orchflow_worker_status to get all worker states]

        Here's the current progress across all components of your e-commerce platform:

        ## 📊 Overall Progress

        **📦 Product Catalog Developer** (75% complete)
        ✅ Database schema designed and implemented
        ✅ CRUD API endpoints for products
        ✅ Category management
        ✅ Image upload handling
        🔄 Search and filtering implementation
        ⏳ Inventory tracking system

        **🛒 Shopping Cart Engineer** (60% complete)
        ✅ Cart session management
        ✅ Add/remove/update items
        ✅ Price calculation with taxes
        🔄 Checkout flow implementation
        ⏳ Order creation and management
        ⏳ Integration with payment service

        **💳 Payment Integration Specialist** (80% complete)
        ✅ Stripe integration
        ✅ Payment intent creation
        ✅ Webhook handling
        ✅ Refund processing
        🔄 Multi-currency support
        ⏳ Payment method management

        **👨‍💼 Admin Dashboard Builder** (40% complete)
        ✅ Authentication system
        ✅ Dashboard layout and navigation
        🔄 Product management interface
        ⏳ Order management
        ⏳ Analytics and reporting
        ⏳ User management

        ## 🔗 Integration Points
        - All components share the same data models ✅
        - Consistent error handling implemented ✅
        - API authentication tokens compatible ✅
        - WebSocket events for real-time updates 🔄

        Would you like me to focus on any specific component or shall I continue 
        pushing all four forward in parallel?

User: Let's make sure the cart and payment systems are fully integrated

Claude: I'll focus on integrating the shopping cart with the payment system. Let me 
        work across both workers to ensure seamless integration.

        [Claude coordinates between workers using context switching and knowledge sharing]

        Here's the integrated checkout flow I've implemented:

        ```typescript
        // In Shopping Cart Worker - Checkout orchestration
        class CheckoutService {
          constructor(
            private cartService: CartService,
            private orderService: OrderService,
            private paymentClient: PaymentClient
          ) {}

          async initiateCheckout(userId: string, cartId: string) {
            // 1. Validate cart
            const cart = await this.cartService.getCart(cartId);
            if (!cart || cart.items.length === 0) {
              throw new ValidationError('Cart is empty', { cart: 'EMPTY_CART' });
            }

            // 2. Calculate final prices
            const pricing = await this.calculatePricing(cart);
            
            // 3. Create order
            const order = await this.orderService.createOrder({
              userId,
              items: cart.items,
              subtotal: pricing.subtotal,
              tax: pricing.tax,
              shipping: pricing.shipping,
              total: pricing.total,
              status: 'pending'
            });

            // 4. Create payment intent
            const paymentIntent = await this.paymentClient.createIntent({
              orderId: order.id,
              amount: order.total,
              customerId: userId
            });

            // 5. Clear cart after successful order creation
            await this.cartService.clearCart(cartId);

            return {
              orderId: order.id,
              paymentClientSecret: paymentIntent.clientSecret,
              total: order.total
            };
          }
        }

        // In Payment Worker - Payment completion handling
        class PaymentWebhookHandler {
          async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
            const { orderId } = paymentIntent.metadata;
            
            // Update order status
            await this.orderService.updateOrder(orderId, {
              status: 'processing',
              paymentId: paymentIntent.id,
              paidAt: new Date()
            });

            // Trigger order fulfillment
            await this.eventBus.emit('order.paid', {
              orderId,
              paymentId: paymentIntent.id
            });

            // Reduce inventory
            const order = await this.orderService.getOrder(orderId);
            for (const item of order.items) {
              await this.inventoryService.reduceStock(
                item.productId, 
                item.quantity
              );
            }
          }
        }
        ```

        The integration is now complete! The cart and payment systems work together:
        
        1. **Checkout Flow**: Shopping cart creates order → Payment system processes
        2. **Success Flow**: Payment webhook → Update order → Reduce inventory
        3. **Error Handling**: Consistent across both systems
        4. **State Management**: Cart cleared only after successful order creation

        Both workers are now fully synchronized on this integration. Should we test 
        the complete flow or move on to another integration point?
```

## Key Benefits

1. **Natural Conversation**: Orchestration happens seamlessly without breaking the flow
2. **Context Awareness**: Claude maintains full context when switching between workers
3. **Automatic Coordination**: Knowledge sharing happens behind the scenes
4. **Proactive Orchestration**: Claude suggests parallel work when it makes sense
5. **Unified Experience**: Feels like one conversation, not multiple separate sessions

## Technical Details

- **MCP Tools**: Injected via Model Context Protocol
- **System Prompt**: Teaches Claude about orchestration patterns
- **State Management**: Orchestration core maintains worker states
- **Context Switching**: Seamless loading of worker contexts
- **Knowledge Sharing**: Automatic propagation of shared information

This approach makes OrchFlow feel like a natural extension of Claude's capabilities rather than an external tool.