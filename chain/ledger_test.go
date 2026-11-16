package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"testing"
)

func TestLedgerPersistence(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}

	b, err := l.Commit([]Transaction{
		{Key: "supply", Value: []byte("1000000000")},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	if l.Height() != 1 || l.Hash() != b.Hash {
		t.Fatal("block recovery failed")
	}
	value, err := l.Get("supply")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(value, []byte("1000000000")) {
		t.Fatal("state recovery failed")
	}
}
func TestLedgerRejectsTamperedBlock(t *testing.T) {
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

	err = l.db.SetSync([]byte("block/00000000000000000001"), []byte("tampered"))
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("tampered block was accepted")
	}
}

func TestLedgerRejectsCorruptState(t *testing.T) {
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

	err = l.db.SetSync([]byte("state/supply"), []byte("999"))
	if err != nil {
		t.Fatal(err)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("corrupt state was accepted")
	}
}

func TestLedgerRejectsOrphanedState(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}

	if err := l.db.SetSync([]byte("state/orphan"), []byte("100")); err != nil {
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("orphaned state was accepted")
	}
}

func TestLedgerRejectsInvalidMetadataHeight(t *testing.T) {
	for _, raw := range [][]byte{
		[]byte("0"),
		[]byte("18446744073709551615"),
	} {
		dir := t.TempDir()
		l, err := OpenLedger(dir)
		if err != nil {
			t.Fatal(err)
		}
		if err := l.db.SetSync([]byte("meta/height"), raw); err != nil {
			l.Close()
			t.Fatal(err)
		}
		if err := l.Close(); err != nil {
			t.Fatal(err)
		}

		_, err = OpenLedger(dir)
		if err != ErrInvalidHeight {
			t.Fatalf("height %s: got %v, want ErrInvalidHeight", raw, err)
		}
	}
}

func TestLedgerRejectsOrphanedBlock(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := l.Commit([]Transaction{
		{Key: "supply", Value: []byte("100")},
	}); err != nil {
		l.Close()
		t.Fatal(err)
	}

	if err := l.db.SetSync([]byte("block/00000000000000000002"), []byte("{}")); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("orphaned block was accepted")
	}
}

func TestLedgerDuplicateKeysLastWriteWins(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}

	_, err = l.Commit([]Transaction{
		{Key: "supply", Value: []byte("100")},
		{Key: "supply", Value: []byte("200")},
	})
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	value, err := l.Get("supply")
	if err != nil || !bytes.Equal(value, []byte("200")) {
		l.Close()
		t.Fatalf("unexpected value: %s, err: %v", value, err)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	value, err = l.Get("supply")
	if err != nil || !bytes.Equal(value, []byte("200")) {
		t.Fatalf("recovery mismatch: %s, err: %v", value, err)
	}
}

func TestLedgerRejectsInvalidTransactions(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	if _, err := l.Commit([]Transaction{
		{Key: "supply", Value: []byte("100")},
	}); err != nil {
		t.Fatal(err)
	}

	height := l.Height()
	hash := l.Hash()

	invalid := []Transaction{
		{Key: "", Value: []byte("x")},
		{Key: "nil-value", Value: nil},
		{Key: "bad-delete", Value: []byte("x"), Delete: true},
	}

	for i, tx := range invalid {
		if _, err := l.Commit([]Transaction{tx}); err == nil {
			t.Fatalf("case %d: expected invalid transaction error", i)
		}

		if l.Height() != height || l.Hash() != hash {
			t.Fatalf("case %d: ledger metadata changed", i)
		}
	}

	value, err := l.Get("supply")
	if err != nil || !bytes.Equal(value, []byte("100")) {
		t.Fatalf("state changed after rejected commit: %s, err: %v", value, err)
	}
}

func TestLedgerCloseMultipleTimes(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	if err := l.Close(); err != nil {
		t.Fatalf("first close failed: %v", err)
	}

	if err := l.Close(); err != nil {
		t.Fatalf("second close failed: %v", err)
	}
}

func TestLedgerConcurrentAccess(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	if _, err := l.Commit([]Transaction{
		{Key: "base", Value: []byte("ready")},
	}); err != nil {
		t.Fatal(err)
	}

	const workers = 8
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()

			key := string(rune('a' + i))
			_, err := l.Commit([]Transaction{
				{Key: key, Value: []byte("ok")},
			})
			if err != nil {
				t.Errorf("worker %d commit: %v", i, err)
				return
			}

			value, err := l.Get("base")
			if err != nil || !bytes.Equal(value, []byte("ready")) {
				t.Errorf("worker %d read: value=%s err=%v", i, value, err)
			}
		}(i)
	}

	wg.Wait()

	if got := l.Height(); got != workers+1 {
		t.Fatalf("height mismatch: got %d, want %d", got, workers+1)
	}

	for i := 0; i < workers; i++ {
		key := string(rune('a' + i))
		value, err := l.Get(key)
		if err != nil || !bytes.Equal(value, []byte("ok")) {
			t.Fatalf("key %q mismatch: value=%s err=%v", key, value, err)
		}
	}
}

func TestLedgerRejectsInvalidTransactionInValidHashBlock(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}

	_, err = l.Commit([]Transaction{
		{Key: "supply", Value: []byte("100")},
	})
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	raw, err := l.db.Get([]byte("block/00000000000000000001"))
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	var b Block
	if err := json.Unmarshal(raw, &b); err != nil {
		l.Close()
		t.Fatal(err)
	}

	b.Tx[0].Value = nil
	b.Hash, err = blockHash(b)
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	raw, err = json.Marshal(b)
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	if err := l.db.SetSync([]byte("block/00000000000000000001"), raw); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.db.SetSync([]byte("meta/hash"), []byte(b.Hash)); err != nil {
		l.Close()
		t.Fatal(err)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("invalid transaction in valid-hash block was accepted")
	}
}

func TestLedgerRejectsInvalidParentHash(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}

	_, err = l.Commit([]Transaction{
		{Key: "first", Value: []byte("1")},
	})
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	_, err = l.Commit([]Transaction{
		{Key: "second", Value: []byte("2")},
	})
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	raw, err := l.db.Get([]byte("block/00000000000000000002"))
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	var b Block
	if err := json.Unmarshal(raw, &b); err != nil {
		l.Close()
		t.Fatal(err)
	}

	b.Parent = "invalid-parent"
	b.Hash, err = blockHash(b)
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	raw, err = json.Marshal(b)
	if err != nil {
		l.Close()
		t.Fatal(err)
	}

	if err := l.db.SetSync([]byte("block/00000000000000000002"), raw); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.db.SetSync([]byte("meta/hash"), []byte(b.Hash)); err != nil {
		l.Close()
		t.Fatal(err)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("invalid parent hash was accepted")
	}
	if !errors.Is(err, ErrInvalidParent) {
		t.Fatalf("expected ErrInvalidParent, got %v", err)
	}
}

func TestLedgerString(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	_, err = l.Commit([]Transaction{
		{Key: "test", Value: []byte("value")},
	})
	if err != nil {
		t.Fatal(err)
	}

	want := "height=1 hash=" + l.Hash()
	if got := l.String(); got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestLedgerCommitEmptyTransactions(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	b, err := l.Commit(nil)
	if err != nil {
		t.Fatal(err)
	}
	if b.Height != 1 || b.Parent != "" || b.Hash == "" {
		t.Fatalf("unexpected empty block: %+v", b)
	}
	if l.Height() != 1 || l.Hash() != b.Hash {
		t.Fatal("ledger metadata was not updated")
	}
}

func TestLedgerCommitAfterClose(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	before := l.Height()
	_, err = l.Commit([]Transaction{
		{Key: "closed", Value: []byte("value")},
	})
	if !errors.Is(err, ErrLedgerClosed) {
		t.Fatalf("expected ErrLedgerClosed, got %v", err)
	}
	if l.Height() != before {
		t.Fatal("height changed after failed commit")
	}
}

func TestLedgerRejectsMissingBlock(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}

	for _, key := range []string{"one", "two"} {
		if _, err := l.Commit([]Transaction{
			{Key: key, Value: []byte(key)},
		}); err != nil {
			l.Close()
			t.Fatal(err)
		}
	}

	if err := l.db.DeleteSync([]byte("block/00000000000000000001")); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("ledger with missing block was accepted")
	}
	if !errors.Is(err, ErrInvalidHash) {
		t.Fatalf("expected ErrInvalidHash, got %v", err)
	}
}

func TestVerifyChainRejectsWrongExpectedTip(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	if _, err := l.Commit([]Transaction{
		{Key: "test", Value: []byte("value")},
	}); err != nil {
		t.Fatal(err)
	}

	if err := verifyChain(l.db, l.Height(), "wrong-tip"); !errors.Is(err, ErrInvalidHash) {
		t.Fatalf("expected ErrInvalidHash, got %v", err)
	}
}

func TestLedgerRejectsMissingMetadataHash(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := l.Commit([]Transaction{
		{Key: "test", Value: []byte("value")},
	}); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.db.DeleteSync([]byte("meta/hash")); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("ledger with missing metadata hash was accepted")
	}
}

func TestLedgerRejectsCorruptMetadataHeight(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := l.Commit(nil); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.db.SetSync([]byte("meta/height"), []byte("not-json")); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("ledger with corrupt metadata height was accepted")
	}
}

func TestLedgerRejectsMissingStateEntry(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := l.Commit([]Transaction{
		{Key: "supply", Value: []byte("100")},
	}); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.db.DeleteSync([]byte("state/supply")); err != nil {
		l.Close()
		t.Fatal(err)
	}
	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err == nil {
		l.Close()
		t.Fatal("ledger with missing state entry was accepted")
	}
}

func TestLedgerDeletePersistence(t *testing.T) {
	dir := t.TempDir()
	l, err := OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := l.Commit([]Transaction{
		{Key: "temporary", Value: []byte("value")},
	}); err != nil {
		l.Close()
		t.Fatal(err)
	}

	if _, err := l.Commit([]Transaction{
		{Key: "temporary", Delete: true},
	}); err != nil {
		l.Close()
		t.Fatal(err)
	}

	value, err := l.Get("temporary")
	if err != nil {
		l.Close()
		t.Fatal(err)
	}
	if value != nil {
		l.Close()
		t.Fatalf("expected deleted key to be nil, got %q", value)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	l, err = OpenLedger(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	value, err = l.Get("temporary")
	if err != nil {
		t.Fatal(err)
	}
	if value != nil {
		t.Fatalf("deleted key returned after reopen: %q", value)
	}
}

func TestLedgerCommitRejectsMaximumHeight(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	l.height = ^uint64(0)

	if _, err := l.Commit(nil); err == nil {
		t.Fatal("expected error at maximum block height")
	}
}

func TestVerifyStateRejectsMaximumHeight(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	err = verifyState(l.db, ^uint64(0))
	if !errors.Is(err, ErrInvalidHeight) {
		t.Fatalf("expected ErrInvalidHeight, got %v", err)
	}
}

func TestLedgerGetAfterClose(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	if err := l.Close(); err != nil {
		t.Fatal(err)
	}

	_, err = l.Get("closed")
	if !errors.Is(err, ErrLedgerClosed) {
		t.Fatalf("expected ErrLedgerClosed, got %v", err)
	}
}

func TestLedgerCommitCopiesCallerTransactions(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	value := []byte("original")
	txs := []Transaction{
		{Key: "account", Value: value},
	}

	block, err := l.Commit(txs)
	if err != nil {
		t.Fatal(err)
	}

	value[0] = 'X'
	txs[0].Key = "changed"

	if block.Tx[0].Key != "account" {
		t.Fatal("committed block aliases caller transaction key")
	}
	if string(block.Tx[0].Value) != "original" {
		t.Fatal("committed block aliases caller transaction value")
	}

	got, err := l.Get("account")
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "original" {
		t.Fatalf("stored value changed: %q", got)
	}
}

func TestLedgerGetReturnsIndependentCopy(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()

	if _, err := l.Commit([]Transaction{
		{Key: "account", Value: []byte("original")},
	}); err != nil {
		t.Fatal(err)
	}

	got, err := l.Get("account")
	if err != nil {
		t.Fatal(err)
	}
	got[0] = 'X'

	again, err := l.Get("account")
	if err != nil {
		t.Fatal(err)
	}
	if string(again) != "original" {
		t.Fatalf("stored value changed after caller mutation: %q", again)
	}
}

func TestLedgerCommitGetCloseConcurrent(t *testing.T) {
	l, err := OpenLedger(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	if _, err := l.Commit([]Transaction{
		{Key: "base", Value: []byte("ready")},
	}); err != nil {
		t.Fatal(err)
	}

	const workers = 8
	start := make(chan struct{})
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start

			for j := 0; j < 20; j++ {
				key := fmt.Sprintf("worker-%d-%d", i, j)
				_, commitErr := l.Commit([]Transaction{
					{Key: key, Value: []byte("ok")},
				})
				if commitErr != nil && commitErr != ErrLedgerClosed {
					t.Errorf("worker %d commit: unexpected error: %v", i, commitErr)
					return
				}

				_, getErr := l.Get("base")
				if getErr != nil && getErr != ErrLedgerClosed {
					t.Errorf("worker %d get: unexpected error: %v", i, getErr)
					return
				}

				if commitErr == ErrLedgerClosed || getErr == ErrLedgerClosed {
					return
				}
			}
		}(i)
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		<-start
		if err := l.Close(); err != nil {
			t.Errorf("concurrent Close: %v", err)
		}
	}()

	close(start)
	wg.Wait()

	if _, err := l.Commit([]Transaction{
		{Key: "after-close", Value: []byte("no")},
	}); err != ErrLedgerClosed {
		t.Fatalf("Commit after Close error = %v, want %v", err, ErrLedgerClosed)
	}

	if _, err := l.Get("base"); err != ErrLedgerClosed {
		t.Fatalf("Get after Close error = %v, want %v", err, ErrLedgerClosed)
	}
}
