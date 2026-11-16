package main

import (
	"bytes"
	"errors"
	"sync"
	"testing"

	dbm "github.com/cosmos/cosmos-db"
)

var (
	errInjectedWrite  = errors.New("injected batch write failure")
	errInjectedSet    = errors.New("injected batch set failure")
	errInjectedDelete = errors.New("injected batch delete failure")
)

type failingBatchDB struct {
	dbm.DB
	failSet    bool
	failDelete bool
	failWrite  bool
}

func (db failingBatchDB) NewBatch() dbm.Batch {
	return &failingBatch{
		Batch:      db.DB.NewBatch(),
		failSet:    db.failSet,
		failDelete: db.failDelete,
		failWrite:  db.failWrite,
	}
}

type failingBatch struct {
	dbm.Batch
	failSet    bool
	failDelete bool
	failWrite  bool
}

func (b *failingBatch) Set(key, value []byte) error {
	if b.failSet {
		return errInjectedSet
	}
	return b.Batch.Set(key, value)
}

func (b *failingBatch) Delete(key []byte) error {
	if b.failDelete {
		return errInjectedDelete
	}
	return b.Batch.Delete(key)
}

func (b *failingBatch) WriteSync() error {
	if b.failWrite {
		return errInjectedWrite
	}
	return b.Batch.WriteSync()
}

func TestLedgerCommitWriteFailure(t *testing.T) {
	dir := t.TempDir()

	db, err := dbm.NewDB("limfxai", dbm.GoLevelDBBackend, dir)
	if err != nil {
		t.Fatal(err)
	}

	l, err := openLedgerDB(db)
	if err != nil {
		t.Fatal(err)
	}

	_, err = l.Commit([]Transaction{
		{Key: "existing", Value: []byte("original")},
	})
	if err != nil {
		t.Fatal(err)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	db, err = dbm.NewDB("limfxai", dbm.GoLevelDBBackend, dir)
	if err != nil {
		t.Fatal(err)
	}

	l, err = openLedgerDB(failingBatchDB{DB: db, failWrite: true})
	if err != nil {
		t.Fatal(err)
	}

	beforeHeight := l.Height()
	beforeHash := l.Hash()

	_, err = l.Commit([]Transaction{
		{Key: "new", Value: []byte("should-not-exist")},
	})
	if !errors.Is(err, errInjectedWrite) {
		t.Fatalf("expected injected write failure, got %v", err)
	}

	if l.Height() != beforeHeight || l.Hash() != beforeHash {
		t.Fatal("ledger metadata changed after failed write")
	}

	value, err := l.Get("existing")
	if err != nil || !bytes.Equal(value, []byte("original")) {
		t.Fatalf("existing state changed: value=%q err=%v", value, err)
	}

	value, err = l.Get("new")
	if err != nil || value != nil {
		t.Fatalf("failed transaction persisted: value=%q err=%v", value, err)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err != nil {
		t.Fatalf("reopen after failed write: %v", err)
	}
	defer l.Close()

	if l.Height() != beforeHeight || l.Hash() != beforeHash {
		t.Fatal("persisted metadata changed after failed write")
	}
}

func TestLedgerCommitBatchOperationFailures(t *testing.T) {
	tests := []struct {
		name       string
		failSet    bool
		failDelete bool
		seed       bool
		tx         Transaction
		wantErr    error
		wantValue  []byte
	}{
		{
			name:    "SetFailure",
			failSet: true,
			tx: Transaction{
				Key:   "new",
				Value: []byte("new-value"),
			},
			wantErr: errInjectedSet,
		},
		{
			name:       "DeleteFailure",
			failDelete: true,
			seed:       true,
			tx: Transaction{
				Key:    "existing",
				Delete: true,
			},
			wantErr:   errInjectedDelete,
			wantValue: []byte("original"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()

			if tt.seed {
				l, err := OpenLedger(dir)
				if err != nil {
					t.Fatal(err)
				}

				_, err = l.Commit([]Transaction{
					{Key: "existing", Value: []byte("original")},
				})
				if err != nil {
					t.Fatal(err)
				}

				if err := l.Close(); err != nil {
					t.Fatal(err)
				}
			}

			db, err := dbm.NewDB("limfxai", dbm.GoLevelDBBackend, dir)
			if err != nil {
				t.Fatal(err)
			}

			l, err := openLedgerDB(failingBatchDB{
				DB:         db,
				failSet:    tt.failSet,
				failDelete: tt.failDelete,
			})
			if err != nil {
				t.Fatal(err)
			}
			defer l.Close()

			beforeHeight := l.Height()
			beforeHash := l.Hash()

			_, err = l.Commit([]Transaction{tt.tx})
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("expected %v, got %v", tt.wantErr, err)
			}

			if l.Height() != beforeHeight || l.Hash() != beforeHash {
				t.Fatal("ledger metadata changed after batch operation failure")
			}

			key := tt.tx.Key
			value, err := l.Get(key)
			if err != nil {
				t.Fatal(err)
			}

			if !bytes.Equal(value, tt.wantValue) {
				t.Fatalf("state changed after failed operation: got %q, want %q", value, tt.wantValue)
			}
		})
	}
}

type closeTrackingDB struct {
	dbm.DB
	failSet    bool
	failDelete bool
	failWrite  bool
	closeCalls *int
}

func (db closeTrackingDB) NewBatch() dbm.Batch {
	return &closeTrackingBatch{
		Batch: &failingBatch{
			Batch:      db.DB.NewBatch(),
			failSet:    db.failSet,
			failDelete: db.failDelete,
			failWrite:  db.failWrite,
		},
		closeCalls: db.closeCalls,
	}
}

type closeTrackingBatch struct {
	dbm.Batch
	closeCalls *int
}

func (b *closeTrackingBatch) Close() error {
	*b.closeCalls++
	return b.Batch.Close()
}

func TestLedgerCommitClosesBatchAfterFailures(t *testing.T) {
	tests := []struct {
		name       string
		failSet    bool
		failDelete bool
		failWrite  bool
		seed       bool
		tx         Transaction
		wantErr    error
	}{
		{
			name:    "SetFailure",
			failSet: true,
			tx:      Transaction{Key: "new", Value: []byte("value")},
			wantErr: errInjectedSet,
		},
		{
			name:       "DeleteFailure",
			failDelete: true,
			seed:       true,
			tx:         Transaction{Key: "existing", Delete: true},
			wantErr:    errInjectedDelete,
		},
		{
			name:      "WriteFailure",
			failWrite: true,
			tx:        Transaction{Key: "new", Value: []byte("value")},
			wantErr:   errInjectedWrite,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()

			if tt.seed {
				l, err := OpenLedger(dir)
				if err != nil {
					t.Fatal(err)
				}
				_, err = l.Commit([]Transaction{
					{Key: "existing", Value: []byte("original")},
				})
				if err != nil {
					t.Fatal(err)
				}
				if err := l.Close(); err != nil {
					t.Fatal(err)
				}
			}

			db, err := dbm.NewDB("limfxai", dbm.GoLevelDBBackend, dir)
			if err != nil {
				t.Fatal(err)
			}

			closeCalls := 0
			l, err := openLedgerDB(closeTrackingDB{
				DB:         db,
				failSet:    tt.failSet,
				failDelete: tt.failDelete,
				failWrite:  tt.failWrite,
				closeCalls: &closeCalls,
			})
			if err != nil {
				t.Fatal(err)
			}

			_, err = l.Commit([]Transaction{tt.tx})
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("expected %v, got %v", tt.wantErr, err)
			}

			if closeCalls != 1 {
				t.Fatalf("batch Close called %d times, want 1", closeCalls)
			}

			if err := l.Close(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

type closeTrackingLedgerDB struct {
	dbm.DB
	closeCalls *int
	closeErr   error
}

func (db closeTrackingLedgerDB) Close() error {
	*db.closeCalls++
	err := db.DB.Close()
	if err != nil {
		return errors.Join(db.closeErr, err)
	}
	return db.closeErr
}

func TestOpenLedgerClosesDBAfterRecoveryFailure(t *testing.T) {
	tests := []struct {
		name string
		key  string
		data []byte
	}{
		{
			name: "CorruptChain",
			key:  "block/00000000000000000001",
			data: []byte("tampered"),
		},
		{
			name: "CorruptState",
			key:  "state/supply",
			data: []byte("999"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()

			l, err := OpenLedger(dir)
			if err != nil {
				t.Fatal(err)
			}

			_, err = l.Commit([]Transaction{
				{Key: "supply", Value: []byte("100")},
			})
			if err != nil {
				t.Fatal(err)
			}

			if err := l.Close(); err != nil {
				t.Fatal(err)
			}

			db, err := dbm.NewDB("limfxai", dbm.GoLevelDBBackend, dir)
			if err != nil {
				t.Fatal(err)
			}

			if err := db.SetSync([]byte(tt.key), tt.data); err != nil {
				t.Fatal(err)
			}
			if err := db.Close(); err != nil {
				t.Fatal(err)
			}

			db, err = dbm.NewDB("limfxai", dbm.GoLevelDBBackend, dir)
			if err != nil {
				t.Fatal(err)
			}

			closeCalls := 0
			_, err = openLedgerDB(closeTrackingLedgerDB{
				DB:         db,
				closeCalls: &closeCalls,
			})
			if err == nil {
				t.Fatal("corrupt ledger was accepted")
			}

			if closeCalls != 1 {
				t.Fatalf("DB Close called %d times, want 1", closeCalls)
			}
		})
	}
}

func TestOpenLedgerKeepsDBOpenOnSuccess(t *testing.T) {
	db, err := dbm.NewDB("limfxai", dbm.GoLevelDBBackend, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	closeCalls := 0
	l, err := openLedgerDB(closeTrackingLedgerDB{
		DB:         db,
		closeCalls: &closeCalls,
	})
	if err != nil {
		t.Fatal(err)
	}

	if closeCalls != 0 {
		t.Fatalf("DB closed during successful open: calls=%d", closeCalls)
	}

	if _, err := l.Commit([]Transaction{
		{Key: "health", Value: []byte("ok")},
	}); err != nil {
		t.Fatalf("commit after open failed: %v", err)
	}

	value, err := l.Get("health")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(value, []byte("ok")) {
		t.Fatalf("unexpected state: %q", value)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	if closeCalls != 1 {
		t.Fatalf("DB Close called %d times, want 1", closeCalls)
	}
}

func TestLedgerCloseReturnsErrorAndRunsOnce(t *testing.T) {
	db, err := dbm.NewDB("limfxai", dbm.GoLevelDBBackend, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	injectedErr := errors.New("injected database close failure")
	closeCalls := 0

	l, err := openLedgerDB(closeTrackingLedgerDB{
		DB:         db,
		closeCalls: &closeCalls,
		closeErr:   injectedErr,
	})
	if err != nil {
		t.Fatal(err)
	}

	firstErr := l.Close()
	if !errors.Is(firstErr, injectedErr) {
		t.Fatalf("Close() error = %v, want injected error", firstErr)
	}

	secondErr := l.Close()
	if !errors.Is(secondErr, injectedErr) {
		t.Fatalf("second Close() error = %v, want injected error", secondErr)
	}

	if closeCalls != 1 {
		t.Fatalf("DB Close called %d times, want 1", closeCalls)
	}
}

func TestLedgerCloseConcurrentCalls(t *testing.T) {
	db, err := dbm.NewDB("limfxai", dbm.GoLevelDBBackend, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	injectedErr := errors.New("concurrent close failure")
	closeCalls := 0

	l, err := openLedgerDB(closeTrackingLedgerDB{
		DB:         db,
		closeCalls: &closeCalls,
		closeErr:   injectedErr,
	})
	if err != nil {
		t.Fatal(err)
	}

	const workers = 32
	var wg sync.WaitGroup
	errs := make(chan error, workers)

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- l.Close()
		}()
	}

	wg.Wait()
	close(errs)

	for err := range errs {
		if !errors.Is(err, injectedErr) {
			t.Errorf("Close() error = %v, want injected error", err)
		}
	}

	if closeCalls != 1 {
		t.Fatalf("DB Close called %d times, want 1", closeCalls)
	}
}
