import {
  describe,
  test,
  assertEqual,
  assertTrue,
  assertFalse,
  createMockSeedDataset
} from '../harness';
import {
  ISheetsService,
  IGmailService,
  ICalendarService,
  IMapsService
} from '../../shared';
import {
  MockSheetsService,
  MockGmailService,
  MockCalendarService,
  MockMapsService,
  GoogleServiceFactory
} from '../helpers/mockServices';

describe('F8: Zero-Friction Demo / Mock Mode Engine', () => {
  test('Test 8.1: Mock SPI provider instantiation without API credentials', () => {
    const factory = new GoogleServiceFactory('DEMO');
    assertEqual(factory.getMode(), 'DEMO');
    assertTrue(factory.getSheetsService() !== null);
    assertTrue(factory.getGmailService() !== null);
    assertTrue(factory.getCalendarService() !== null);
    assertTrue(factory.getMapsService() !== null);
  });

  test('Test 8.2: Live vs Demo mode instant toggle and state retention', () => {
    const factory = new GoogleServiceFactory('DEMO');
    assertEqual(factory.getMode(), 'DEMO');

    factory.setMode('LIVE');
    assertEqual(factory.getMode(), 'LIVE');

    factory.setMode('DEMO');
    assertEqual(factory.getMode(), 'DEMO');
  });

  test('Test 8.3: Fashion boutique SME seed dataset loading and validation', async () => {
    const factory = new GoogleServiceFactory('DEMO');
    const result = factory.loadSeedData('fashion');

    assertEqual(result.category, 'fashion');
    assertEqual(result.shopName, 'Tiệm Lụa & Cổ Phục Hà Nội');
    assertTrue(result.itemCount >= 3);

    const inventory = await factory.getSheetsService().getInventory();
    assertEqual(inventory.length, 3);
    assertTrue(inventory.some(i => i.name.includes('Áo Dài')));
  });

  test('Test 8.4: F&B specialty drink SME seed dataset loading and validation', async () => {
    const factory = new GoogleServiceFactory('DEMO');
    const result = factory.loadSeedData('fnb');

    assertEqual(result.category, 'fnb');
    assertEqual(result.shopName, 'Trà Sữa & Đặc Sản Trái Cây Miền Tây');
    assertTrue(result.itemCount >= 3);

    const inventory = await factory.getSheetsService().getInventory();
    assertTrue(inventory.some(i => i.unit === 'ly'));
    assertTrue(inventory.some(i => i.name.includes('Cà Phê Muối')));
  });

  test('Test 8.5: Natural cosmetics SME seed dataset loading and validation', async () => {
    const factory = new GoogleServiceFactory('DEMO');
    const result = factory.loadSeedData('cosmetics');

    assertEqual(result.category, 'cosmetics');
    assertEqual(result.shopName, 'Mỹ Phẩm Thiên Nhiên Việt Xanh');
    assertTrue(result.itemCount >= 3);

    const inventory = await factory.getSheetsService().getInventory();
    assertTrue(inventory.some(i => i.name.includes('Serum Rau Má')));
    assertTrue(inventory.some(i => i.unit === 'chai' || i.unit === 'tuýp' || i.unit === 'thỏi'));
  });
});
