package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	dbm "github.com/cosmos/cosmos-db"
)

var (
	ErrInvalidHeight = errors.New("invalid block height")
	ErrInvalidParent = errors.New("invalid parent hash")
	ErrInvalidHash   = errors.New("invalid block hash")
	ErrLedgerClosed  = errors.New("ledger is closed")
)

type Transaction struct {
	Key    string `json:"key"`
	Value  []byte `json:"value"`
	Delete bool   `json:"delete,omitempty"`
}

type Block struct {
	Height uint64        `json:"height"`
	Parent string        `json:"parent"`
	Tx     []Transaction `json:"transactions"`
	Hash   string        `json:"hash"`
}

type Ledger struct {
	db        dbm.DB
	mu        sync.RWMutex
	closeOnce sync.Once
	closeErr  error
	closed    bool
	height    uint64
	hash      string
}

func blockHash(b Block) (string, error) {
	b.Hash = ""
	data, err := json.Marshal(b)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}

func (l *Ledger) Height() uint64 {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.height
}

func (l *Ledger) Hash() string {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.hash
}

func (l *Ledger) Close() error {
	l.closeOnce.Do(func() {
		l.mu.Lock()
		defer l.mu.Unlock()
		l.closed = true
		l.closeErr = l.db.Close()
	})
	return l.closeErr
}

func (l *Ledger) String() string {
	return fmt.Sprintf("height=%d hash=%s", l.Height(), l.Hash())
}

func verifyChain(db dbm.DB, height uint64, expectedTip string) (retErr error) {
	parent := ""
	if height == ^uint64(0) {
		return ErrInvalidHeight
	}

	for n := uint64(1); n <= height; n++ {
		raw, err := db.Get([]byte(fmt.Sprintf("block/%020d", n)))
		if err != nil {
			return err
		}

		var b Block
		if err := json.Unmarshal(raw, &b); err != nil {
			return ErrInvalidHash
		}

		if b.Height != n {
			return ErrInvalidHeight
		}
		if b.Parent != parent {
			return ErrInvalidParent
		}

		calculated, err := blockHash(b)
		if err != nil || calculated != b.Hash {
			return ErrInvalidHash
		}

		parent = b.Hash
	}

	itr, err := dbm.IteratePrefix(db, []byte("block/"))
	if err != nil {
		return err
	}
	defer func() { retErr = errors.Join(retErr, itr.Close()) }()
	expected := uint64(1)
	for ; itr.Valid(); itr.Next() {
		want := []byte(fmt.Sprintf("block/%020d", expected))
		if !bytes.Equal(itr.Key(), want) {
			return ErrInvalidHeight
		}
		expected++
	}
	if err := itr.Error(); err != nil {
		return err
	}
	if expected != height+1 {
		return ErrInvalidHeight
	}

	if parent != expectedTip {
		return ErrInvalidHash
	}
	return nil
}

func OpenLedger(dir string) (*Ledger, error) {
	db, err := dbm.NewDB("limfxai", dbm.GoLevelDBBackend, dir)
	if err != nil {
		return nil, err
	}
	return openLedgerDB(db)
}

func openLedgerDB(db dbm.DB) (result *Ledger, retErr error) {
	keepDB := false
	defer func() {
		if !keepDB {
			if closeErr := db.Close(); closeErr != nil {
				retErr = errors.Join(retErr, closeErr)
			}
		}
	}()
	l := &Ledger{db: db}
	h, err := db.Get([]byte("meta/height"))
	if err != nil {
		return nil, err
	}
	if len(h) == 0 {
		hash, err := db.Get([]byte("meta/hash"))
		if err != nil || len(hash) != 0 {
			return nil, errors.New("corrupt empty ledger metadata")
		}
		for _, prefix := range [][]byte{[]byte("block/"), []byte("state/")} {
			itr, err := dbm.IteratePrefix(db, prefix)
			if err != nil {
				return nil, err
			}
			dirty := itr.Valid()
			iterErr := itr.Error()
			closeErr := itr.Close()
			if iterErr != nil || closeErr != nil {
				return nil, errors.Join(iterErr, closeErr)
			}
			if dirty {
				return nil, errors.New("orphaned ledger data")
			}
		}
		keepDB = true
		return l, nil
	}
	var height uint64
	if err := json.Unmarshal(h, &height); err != nil {
		return nil, err
	}
	if height == 0 || height == ^uint64(0) {
		return nil, ErrInvalidHeight
	}
	hash, err := db.Get([]byte("meta/hash"))
	if err != nil || len(hash) == 0 {
		return nil, errors.New("corrupt ledger metadata")
	}
	var block Block
	raw, err := db.Get([]byte(fmt.Sprintf("block/%020d", height)))
	if err != nil || json.Unmarshal(raw, &block) != nil {
		return nil, errors.New("corrupt ledger tip")
	}
	calculated, err := blockHash(block)
	if err != nil || calculated != string(hash) || block.Hash != string(hash) {
		return nil, ErrInvalidHash
	}
	if err := verifyChain(db, height, string(hash)); err != nil {
		return nil, err
	}

	if err := verifyState(db, height); err != nil {
		return nil, err
	}
	l.height, l.hash = height, string(hash)
	keepDB = true
	return l, nil
}

func verifyState(db dbm.DB, height uint64) (retErr error) {
	expected := make(map[string][]byte)
	if height == ^uint64(0) {
		return ErrInvalidHeight
	}

	for n := uint64(1); n <= height; n++ {
		raw, err := db.Get([]byte(fmt.Sprintf("block/%020d", n)))
		if err != nil {
			return err
		}

		var b Block
		if err := json.Unmarshal(raw, &b); err != nil {
			return ErrInvalidHash
		}

		for _, tx := range b.Tx {
			if tx.Key == "" || (!tx.Delete && tx.Value == nil) || (tx.Delete && tx.Value != nil) {
				return errors.New("invalid transaction in block")
			}
			if tx.Delete {
				delete(expected, tx.Key)
			} else {
				expected[tx.Key] = tx.Value
			}
		}
	}

	itr, err := dbm.IteratePrefix(db, []byte("state/"))
	if err != nil {
		return err
	}
	defer func() { retErr = errors.Join(retErr, itr.Close()) }()

	for ; itr.Valid(); itr.Next() {
		key := string(itr.Key()[len("state/"):])
		want, ok := expected[key]

		if !ok || !bytes.Equal(itr.Value(), want) {
			return errors.New("ledger state mismatch")
		}
		delete(expected, key)
	}

	if err := itr.Error(); err != nil {
		return err
	}
	if len(expected) != 0 {
		return errors.New("ledger state missing entries")
	}

	return nil
}

func (l *Ledger) Get(key string) ([]byte, error) {
	if key == "" {
		return nil, errors.New("empty state key")
	}
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.closed {
		return nil, ErrLedgerClosed
	}
	value, err := l.db.Get([]byte("state/" + key))
	if err != nil || value == nil {
		return value, err
	}
	return bytes.Clone(value), nil
}

func (l *Ledger) Commit(txs []Transaction) (result Block, retErr error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.closed {
		return Block{}, ErrLedgerClosed
	}

	copiedTxs := make([]Transaction, len(txs))
	for i, tx := range txs {
		copiedTxs[i] = tx
		if tx.Value != nil {
			copiedTxs[i].Value = bytes.Clone(tx.Value)
		}
	}
	txs = copiedTxs

	for _, tx := range txs {
		if tx.Key == "" || (!tx.Delete && tx.Value == nil) || (tx.Delete && tx.Value != nil) {
			return Block{}, errors.New("invalid transaction")
		}
	}
	if l.height == ^uint64(0) {
		return Block{}, errors.New("maximum block height reached")
	}

	b := Block{Height: l.height + 1, Parent: l.hash, Tx: txs}
	hash, err := blockHash(b)
	if err != nil {
		return Block{}, err
	}
	b.Hash = hash

	raw, err := json.Marshal(b)
	if err != nil {
		return Block{}, err
	}
	heightRaw, err := json.Marshal(b.Height)
	if err != nil {
		return Block{}, err
	}

	batch := l.db.NewBatch()
	defer func() {
		if closeErr := batch.Close(); closeErr != nil {
			l.closed = true
			retErr = errors.Join(retErr, closeErr)
			result = Block{}
		}
	}()

	for _, tx := range txs {
		key := []byte("state/" + tx.Key)
		if tx.Delete {
			err = batch.Delete(key)
		} else {
			err = batch.Set(key, tx.Value)
		}
		if err != nil {
			return Block{}, err
		}
	}
	if err = batch.Set([]byte(fmt.Sprintf("block/%020d", b.Height)), raw); err != nil {
		return Block{}, err
	}
	if err = batch.Set([]byte("meta/height"), heightRaw); err != nil {
		return Block{}, err
	}
	if err = batch.Set([]byte("meta/hash"), []byte(hash)); err != nil {
		return Block{}, err
	}
	if err = batch.WriteSync(); err != nil {
		l.closed = true
		return Block{}, err
	}

	l.height, l.hash = b.Height, hash
	return b, nil
}
