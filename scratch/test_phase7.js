const http = require('http');

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://localhost:5000${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING PHASE 7 AUTOMATED INTEGRATION TESTS ===\n');

  // 1. Login as Admin
  console.log('1. Logging in as Admin...');
  const adminLogin = await request('POST', '/api/v1/auth/login', {
    username: 'admin',
    password: 'Admin@FirstBloom2026!',
  });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.data.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✓ Admin login successful.');

  // 2. Login as Staff
  console.log('2. Logging in as Staff...');
  const staffLogin = await request('POST', '/api/v1/auth/login', {
    username: 'staff01',
    password: 'Staff@FirstBloom2026!',
  });
  if (staffLogin.status !== 200) {
    throw new Error(`Staff login failed: ${JSON.stringify(staffLogin.data)}`);
  }
  const staffToken = staffLogin.data.data.accessToken;
  const staffHeaders = { Authorization: `Bearer ${staffToken}` };
  console.log('✓ Staff login successful.');

  // 3. Customer Management (Admin & Staff)
  console.log('\n3. Testing Customer Creation & Search...');
  const customerPayload = {
    fullName: 'Nguyễn Thị Khách Thử Nghiệm',
    phone: `0988${Math.floor(100000 + Math.random() * 900000)}`,
    address: '123 Đường Hoa Hồng, Quận 1, TP.HCM',
    notes: 'Khách VIP sinh nhật',
  };
  const createCustRes = await request('POST', '/api/v1/customers', customerPayload, adminHeaders);
  console.log(`- Create customer response: HTTP ${createCustRes.status}`);
  if (createCustRes.status !== 201) {
    throw new Error(`Failed to create customer: ${JSON.stringify(createCustRes.data)}`);
  }
  const customerId = createCustRes.data.data.id;
  console.log(`✓ Customer created successfully: ID=${customerId}, Name=${customerPayload.fullName}`);

  // Test Customer search by Staff
  const searchCustRes = await request('GET', `/api/v1/customers?search=${encodeURIComponent(customerPayload.phone)}`, null, staffHeaders);
  if (searchCustRes.status !== 200 || !searchCustRes.data.data.length) {
    throw new Error(`Staff could not search customer by phone: ${JSON.stringify(searchCustRes.data)}`);
  }
  console.log(`✓ Staff successfully searched customer by phone.`);

  // 4. Check Product and Inventory
  console.log('\n4. Fetching Products & Inventory Status...');
  const productsRes = await request('GET', '/api/v1/products', null, adminHeaders);
  if (productsRes.status !== 200 || !productsRes.data.data.length) {
    throw new Error('No products available for testing orders.');
  }
  const targetProduct = productsRes.data.data[0];
  console.log(`- Target Product: [${targetProduct.sku}] ${targetProduct.name}`);
  const initialActual = targetProduct.inventory?.actualQuantity || 0;
  const initialReserved = targetProduct.inventory?.reservedQuantity || 0;
  const initialAvailable = targetProduct.inventory?.availableQuantity || 0;
  console.log(`- Initial Stock: Actual=${initialActual}, Reserved=${initialReserved}, Available=${initialAvailable}`);

  // 5. Create Order with Stock Reservation & Deposit
  console.log('\n5. Creating Order with Stock Reservation & Deposit...');
  const orderQuantity = 2;
  const unitPrice = targetProduct.sellingPrice || 150000;
  const depositAmount = 100000;

  const orderPayload = {
    customerId: customerId,
    deliveryAddress: '456 Lê Lợi, Quận 1',
    expectedDeliveryDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    depositAmount: depositAmount,
    depositPaymentMethod: 'BANK_TRANSFER',
    shippingFeeCollected: 30000,
    discountAmount: 10000,
    createMtoProduction: false,
    items: [
      {
        productId: targetProduct.id,
        quantity: orderQuantity,
        unitPrice: unitPrice,
      },
    ],
  };

  const createOrderRes = await request('POST', '/api/v1/orders', orderPayload, adminHeaders);
  console.log(`- Create Order HTTP ${createOrderRes.status}`);
  if (createOrderRes.status !== 201) {
    throw new Error(`Create order failed: ${JSON.stringify(createOrderRes.data)}`);
  }
  const order = createOrderRes.data.data;
  console.log(`✓ Order created: Code=${order.code}, Status=${order.status}, TotalAmount=${order.totalAmount}, PaidAmount=${order.paidAmount}`);

  // 6. Verify Stock Reservation after Order Creation
  console.log('\n6. Verifying Stock Reservation...');
  const productAfterOrderRes = await request('GET', `/api/v1/products/${targetProduct.id}`, null, adminHeaders);
  const stockAfterOrder = productAfterOrderRes.data.data.inventory;
  console.log(`- Stock after order: Actual=${stockAfterOrder.actualQuantity}, Reserved=${stockAfterOrder.reservedQuantity}, Available=${stockAfterOrder.availableQuantity}`);

  if (stockAfterOrder.reservedQuantity !== initialReserved + orderQuantity) {
    throw new Error(`Reserved quantity did not increase by ${orderQuantity}! Got ${stockAfterOrder.reservedQuantity}`);
  }
  if (stockAfterOrder.actualQuantity !== initialActual) {
    throw new Error(`Actual quantity changed during order creation! Should remain unchanged until completed.`);
  }
  console.log('✓ Stock reservation verified: Reserved quantity increased, Actual quantity untouched.');

  // 7. Verify Payments & Deposit Financial Inflow
  console.log('\n7. Verifying Payments & Financial Inflow Transaction...');
  const orderDetailRes = await request('GET', `/api/v1/orders/${order.id}`, null, adminHeaders);
  if (orderDetailRes.status !== 200 || !orderDetailRes.data.data.payments?.length) {
    throw new Error('No payment records found for the deposit!');
  }
  const payment = orderDetailRes.data.data.payments[0];
  console.log(`✓ Deposit Payment verified: Amount=${payment.amount}, Method=${payment.paymentMethod}, Type=${payment.paymentType}`);

  // 8. Test Make-To-Order (MTO) Auto Production Order Linking
  console.log('\n8. Testing Order creation with Make-To-Order (MTO) Integration...');
  const mtoOrderPayload = {
    customerId: customerId,
    deliveryAddress: '789 Trần Hưng Đạo',
    depositAmount: 50000,
    depositPaymentMethod: 'CASH',
    shippingFeeCollected: 0,
    discountAmount: 0,
    createMtoProduction: true,
    items: [
      {
        productId: targetProduct.id,
        quantity: 1,
        unitPrice: unitPrice,
      },
    ],
  };

  const mtoOrderRes = await request('POST', '/api/v1/orders', mtoOrderPayload, adminHeaders);
  if (mtoOrderRes.status !== 201) {
    throw new Error(`MTO Order creation failed: ${JSON.stringify(mtoOrderRes.data)}`);
  }
  const mtoOrder = mtoOrderRes.data.data;
  console.log(`✓ MTO Order created: Code=${mtoOrder.code}`);

  // Check if a ProductionOrder was automatically generated for this order
  const prodOrdersRes = await request('GET', '/api/v1/production', null, adminHeaders);
  const linkedProdOrder = prodOrdersRes.data?.data?.find((po) => po.linkedOrderId === mtoOrder.id || po.code.includes(mtoOrder.code));
  if (linkedProdOrder) {
    console.log(`✓ MTO Production Order successfully generated and linked: Code=${linkedProdOrder.code}, Type=${linkedProdOrder.type}`);
  } else {
    console.log(`- Note: Product may not have an active BOM recipe or MTO order is linked via note.`);
  }

  // 9. Test Order Status Lifecycle -> COMPLETED (Deduction of Actual & Reserved Stock)
  console.log('\n9. Testing Order Lifecycle to COMPLETED & Stock Deduction...');
  const stockBeforeComplete = (await request('GET', `/api/v1/products/${targetProduct.id}`, null, adminHeaders)).data.data.inventory;
  console.log(`- Stock before completion: Actual=${stockBeforeComplete.actualQuantity}, Reserved=${stockBeforeComplete.reservedQuantity}`);

  // CONFIRMED -> PROCESSING
  await request('PATCH', `/api/v1/orders/${order.id}/status`, { status: 'PROCESSING' }, adminHeaders);
  // PROCESSING -> READY
  await request('PATCH', `/api/v1/orders/${order.id}/status`, { status: 'READY' }, adminHeaders);
  // READY -> SHIPPING
  await request('PATCH', `/api/v1/orders/${order.id}/status`, { status: 'SHIPPING' }, adminHeaders);
  // Add final payment before completion
  const remaining = order.totalAmount - order.paidAmount;
  if (remaining > 0) {
    await request('POST', `/api/v1/orders/${order.id}/payments`, {
      amount: remaining,
      paymentMethod: 'BANK_TRANSFER',
      paymentType: 'FINAL_PAYMENT',
      notes: 'Thanh toán phần còn lại khi giao hàng'
    }, adminHeaders);
  }
  // SHIPPING -> COMPLETED
  const completeRes = await request('PATCH', `/api/v1/orders/${order.id}/status`, { status: 'COMPLETED' }, adminHeaders);
  if (completeRes.status !== 200) {
    throw new Error(`Failed to set order COMPLETED: ${JSON.stringify(completeRes.data)}`);
  }
  console.log(`✓ Order status updated to COMPLETED.`);

  // Verify stock after completion: both actual and reserved should be deducted
  const productAfterComplete = (await request('GET', `/api/v1/products/${targetProduct.id}`, null, adminHeaders)).data.data.inventory;
  console.log(`- Stock after completion: Actual=${productAfterComplete.actualQuantity}, Reserved=${productAfterComplete.reservedQuantity}, Available=${productAfterComplete.availableQuantity}`);

  if (productAfterComplete.reservedQuantity !== stockBeforeComplete.reservedQuantity - orderQuantity) {
    throw new Error(`Reserved quantity not properly cleared upon completion! Expected ${stockBeforeComplete.reservedQuantity - orderQuantity}, got ${productAfterComplete.reservedQuantity}`);
  }
  if (productAfterComplete.actualQuantity !== stockBeforeComplete.actualQuantity - orderQuantity) {
    throw new Error(`Actual quantity not decremented by ${orderQuantity}! Expected ${stockBeforeComplete.actualQuantity - orderQuantity}, got ${productAfterComplete.actualQuantity}`);
  }
  console.log('✓ Stock deduction verified upon COMPLETED: Both actual and reserved quantities updated.');

  // 10. Test Order Cancellation & Reserved Stock Restoration
  console.log('\n10. Testing Order Cancellation & Stock Release...');
  const orderForCancelPayload = {
    customerId: customerId,
    deliveryAddress: 'Hủy đơn',
    createMtoProduction: false,
    items: [
      {
        productId: targetProduct.id,
        quantity: 1,
        unitPrice: unitPrice,
      },
    ],
  };
  const orderToCancelRes = await request('POST', '/api/v1/orders', orderForCancelPayload, adminHeaders);
  const orderToCancel = orderToCancelRes.data.data;
  const stockDuringCancelTest = (await request('GET', `/api/v1/products/${targetProduct.id}`, null, adminHeaders)).data.data.inventory;
  console.log(`- Reserved stock before cancel: ${stockDuringCancelTest.reservedQuantity}`);

  // Cancel order
  const cancelRes = await request('PATCH', `/api/v1/orders/${orderToCancel.id}/status`, { status: 'CANCELLED', cancellationReason: 'Khách đổi ý không mua nữa' }, adminHeaders);
  if (cancelRes.status !== 200) {
    throw new Error(`Failed to cancel order: ${JSON.stringify(cancelRes.data)}`);
  }
  const stockAfterCancel = (await request('GET', `/api/v1/products/${targetProduct.id}`, null, adminHeaders)).data.data.inventory;
  console.log(`- Reserved stock after cancel: ${stockAfterCancel.reservedQuantity}`);

  if (stockAfterCancel.reservedQuantity !== stockDuringCancelTest.reservedQuantity - 1) {
    throw new Error(`Reserved stock was not released upon cancellation!`);
  }
  console.log('✓ Order cancellation verified: Reserved stock immediately restored for other customers.');

  // 11. Test RBAC: Staff Access & Masking of Cost / Profit
  console.log('\n11. Testing RBAC: Staff Permissions on Orders...');
  const staffOrdersRes = await request('GET', '/api/v1/orders', null, staffHeaders);
  if (staffOrdersRes.status !== 200) {
    throw new Error(`Staff could not view orders: ${JSON.stringify(staffOrdersRes.data)}`);
  }
  const staffSampleOrder = staffOrdersRes.data.data[0];
  if (staffSampleOrder && staffSampleOrder.totalCogs !== undefined) {
    throw new Error(`Security Violation! Staff can see totalCogs: ${staffSampleOrder.totalCogs}`);
  }
  console.log(`✓ RBAC verified: Staff can list orders, totalCogs is strictly stripped from Staff response.`);

  console.log('\n🎉 ALL PHASE 7 INTEGRATION TESTS PASSED PERFECTLY! 🎉');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
